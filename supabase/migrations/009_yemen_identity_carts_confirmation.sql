-- ─────────────────────────────────────────────────────────────
-- 009 — الأساس اليمني: تأكيد الطلب وخصم المخزون + سلة العميل + طرق الدفع
-- آمن للتشغيل المتكرر (idempotent).
--
-- يتضمن:
--   1. orders.stock_state (none/reserved/released) + تعبئة الطلبات القائمة.
--   2. confirm_order_stock(p_order_id) — التأكيد والخصم ذرّياً.
--   3. إعادة كتابة release_order_stock لتعتمد stock_state.
--   4. orders.payment_method_id + توسيع قيد الدفع إلى cod/transfer/wallet.
--   5. profiles.phone · profiles.admin_note + نسخ الجوال عند التسجيل.
--   6. customer_carts — سلة واحدة لكل عميل مسجّل (RLS بلا سياسات).
--   7. settings.payment_methods — ترحيل bank_transfer القديم.
-- ─────────────────────────────────────────────────────────────

begin;

-- ── 1) حالة المخزون في الطلبات ─────────────────────────────────────
alter table public.orders
  add column if not exists stock_state text not null default 'none';

-- الطلبات القائمة أُنشئت بتدفّق الحجز القديم (الخصم عند الإنشاء).
-- نعكس الواقع: ما أُعيد مخزونه → released، وما زال مخصوماً → reserved.
update public.orders
   set stock_state = case
         when stock_released then 'released'
         when status in ('new', 'confirmed', 'completed') then 'reserved'
         else 'none'
       end
 where stock_state = 'none';

alter table public.orders drop constraint if exists orders_stock_state_check;
alter table public.orders
  add constraint orders_stock_state_check
  check (stock_state in ('none', 'reserved', 'released'));

create index if not exists orders_stock_state_idx on public.orders (stock_state);

comment on column public.orders.stock_state is
  'none = لم يُخصم · reserved = خُصم عند تأكيد المدير · released = أُعيد بعد الإلغاء';

-- ── 2) تأكيد الطلب وخصم المخزون (ذرّي) ─────────────────────────────
-- يستخدم reserve_stock نفسها التي ترفع OUT_OF_STOCK:<id> عند النقص،
-- فلا خصم جزئي. الطلب المؤكد مسبقاً لا يُخصم مرتين.
create or replace function public.confirm_order_stock(p_order_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
  v_state  text;
  v_items  jsonb;
begin
  select status, stock_state, items
    into v_status, v_state, v_items
    from public.orders
   where id = p_order_id
     for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND:%', p_order_id;
  end if;

  if v_status not in ('new', 'confirmed') then
    raise exception 'ORDER_NOT_CONFIRMABLE:%', v_status;
  end if;

  -- مؤكد ومخصوم مسبقاً: نضمن الحالة فقط.
  if v_state = 'reserved' then
    update public.orders set status = 'confirmed' where id = p_order_id;
    return 'reserved';
  end if;

  perform public.reserve_stock(
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'productId', it->>'productId',
                   'qty', (it->>'qty')::int,
                   'color', it->>'color'
                 )
               )
          from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as it
         where it ? 'productId'
           and (it->>'qty') ~ '^[0-9]+$'
      ),
      '[]'::jsonb
    )
  );

  update public.orders
     set status = 'confirmed',
         stock_state = 'reserved',
         stock_released = false
   where id = p_order_id;

  return 'reserved';
end;
$function$;

revoke all on function public.confirm_order_stock(text) from public;
revoke all on function public.confirm_order_stock(text) from anon;
revoke all on function public.confirm_order_stock(text) from authenticated;
grant execute on function public.confirm_order_stock(text) to service_role;

-- ── 3) تحرير المخزون عند الإلغاء — مرة واحدة فقط ──────────────────
create or replace function public.release_order_stock(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_items jsonb;
begin
  update public.orders
     set stock_state = 'released',
         stock_released = true
   where id = p_order_id
     and stock_state = 'reserved'
  returning items into v_items;

  if not found then
    return false;
  end if;

  perform public.release_stock(
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'productId', it->>'productId',
                   'qty', (it->>'qty')::int,
                   'color', it->>'color'
                 )
               )
          from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as it
         where it ? 'productId'
           and (it->>'qty') ~ '^[0-9]+$'
      ),
      '[]'::jsonb
    )
  );

  return true;
end;
$function$;

revoke all on function public.release_order_stock(text) from public;
revoke all on function public.release_order_stock(text) from anon;
revoke all on function public.release_order_stock(text) from authenticated;
grant execute on function public.release_order_stock(text) to service_role;

-- reserve_order_stock لم تبقَ مستخدمة: إعادة الفتح تعيد الطلب إلى new
-- بلا حجز، والخصم عند التأكيد فقط. نُبقيها معطّلة لأي نداء قديم.
revoke all on function public.reserve_order_stock(text) from anon;
revoke all on function public.reserve_order_stock(text) from authenticated;
grant execute on function public.reserve_order_stock(text) to service_role;

-- ── 4) طريقة الدفع: معرّف + قيد جديد ───────────────────────────────
alter table public.orders
  add column if not exists payment_method_id text;

-- لا بوابات بطاقات: card ميتة وتُحذف.
alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders
  add constraint orders_payment_check
  check (payment in ('cod', 'transfer', 'wallet'));

create index if not exists orders_payment_method_idx on public.orders (payment_method_id);

comment on column public.orders.payment_method_id is
  'معرّف الطريقة داخل settings.payment_methods (فارغ للدفع عند الاستلام)';

-- ── 5) الملف الشخصي: جوال + ملاحظة المدير ─────────────────────────
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists admin_note text;

comment on column public.profiles.phone is 'جوال العميل بصيغة يمنية (7xxxxxxxx أو +967…)';
comment on column public.profiles.admin_note is 'ملاحظة داخلية للمدير — لا تظهر للعميل';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, provider, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    case
      when coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then 'admin'
      else 'customer'
    end,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ── 6) سلة العميل المسجّل ──────────────────────────────────────────
-- سلة واحدة لكل عميل تتبعه على أجهزته. لا تحجز ولا تخصم مخزوناً.
create table if not exists public.customer_carts (
  customer_id uuid not null references auth.users (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  option      text not null default '',
  color       text not null default '',
  qty         smallint not null default 1 check (qty between 1 and 20),
  updated_at  timestamptz not null default now(),
  primary key (customer_id, product_id, option, color)
);

create index if not exists customer_carts_customer_idx
  on public.customer_carts (customer_id);

alter table public.customer_carts enable row level security;

-- لا سياسات عامة: الوصول من الخادم بمفتاح service_role فقط.

drop trigger if exists customer_carts_touch_updated_at on public.customer_carts;
create trigger customer_carts_touch_updated_at
  before update on public.customer_carts
  for each row execute function public.touch_updated_at();

-- ── 7) طرق الدفع: ترحيل bank_transfer القديم ──────────────────────
insert into public.settings (key, value)
select
  'payment_methods',
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'id', 'pm_bank_legacy',
                 'type', 'bank',
                 'name', coalesce(nullif(bt.value->>'bankName', ''), 'تحويل بنكي'),
                 'accountName', coalesce(bt.value->>'accountName', ''),
                 'accountNumber', coalesce(bt.value->>'iban', ''),
                 'note', coalesce(bt.value->>'note', ''),
                 'active', true,
                 'sort', 1
               )
             )
        from public.settings bt
       where bt.key = 'bank_transfer'
         and coalesce(bt.value->>'iban', '') <> ''
    ),
    '[]'::jsonb
  )
from public.settings
where key = 'bank_transfer'
on conflict (key) do nothing;

insert into public.settings (key, value)
values ('payment_methods', '[]'::jsonb)
on conflict (key) do nothing;

commit;
