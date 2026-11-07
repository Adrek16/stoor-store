-- ─────────────────────────────────────────────────────────────
-- ستور — مخطط قاعدة البيانات (Supabase / Postgres)
-- نفّذه في SQL Editor داخل مشروع Supabase، أو عبر:
--   npm run db:migrate
-- الملف آمن للتشغيل المتكرر (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- 1) التصنيفات
-- ═════════════════════════════════════════════════════════════
create table if not exists public.categories (
  slug         text primary key,
  name         text not null,
  name_en      text not null default '',
  parent       text,
  gender       text check (gender in ('men','women','unisex','kids')),
  blurb        text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

-- ═════════════════════════════════════════════════════════════
-- 2) المنتجات
-- ═════════════════════════════════════════════════════════════
create table if not exists public.products (
  id           text primary key,
  slug         text not null unique,
  name         text not null,
  subtitle     text not null default '',
  category     text not null references public.categories (slug)
                 on update cascade on delete restrict,
  gender       text not null check (gender in ('men','women','unisex','kids')),

  price        numeric(10,2) not null check (price >= 0),
  compare_at   numeric(10,2) check (compare_at is null or compare_at >= 0),

  rating       numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews      int  not null default 0 check (reviews >= 0),
  badge        text check (badge in ('new','best','sale','limited')),

  -- شكل الرسم المولّد ولونه (يُستبدل برابط صورة لاحقاً)
  artwork      text not null default 'perfume',
  tone         text not null default '#c87f62',

  -- بنية مرنة: { label, values } / [{ name, hex, stock? }] / { top[], heart[], base[] }
  -- colors[].stock مخزون اللون، وstock الكلي = مجموع الألوان (يُدار من لوحة المدير).
  options      jsonb,
  colors       jsonb,
  notes        jsonb,

  description  text  not null default '',
  features     jsonb not null default '[]'::jsonb,

  -- صور حقيقية من bucket product-images (الرسوم SVG تبقى بديلاً عند غيابها)
  image_path   text,
  color_images jsonb not null default '{}'::jsonb
               check (jsonb_typeof(color_images) = 'object'),

  stock        int  not null default 0 check (stock >= 0),
  active       boolean not null default true,
  sort_order   int  not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_gender_idx   on public.products (gender);
create index if not exists products_active_idx   on public.products (active, sort_order);
create index if not exists products_price_idx    on public.products (price);

-- تحديث updated_at تلقائياً عند أي تعديل
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 3) الطلبات
-- ═════════════════════════════════════════════════════════════
create table if not exists public.orders (
  id               text primary key,
  created_at       timestamptz not null default now(),
  -- لا شحن ولا توصيل: الاستلام من المتجر فقط.
  status           text not null default 'new'
                   check (status in ('new','confirmed','completed','cancelled')),

  customer_name    text not null,
  customer_phone   text not null,
  notes            text,

  subtotal         numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  coupon_code      text,

  payment          text not null default 'cod'
                   check (payment in ('cod','transfer','wallet')),
  payment_method_id text,

  -- حالة خصم المخزون: يخصم المدير عند التأكيد فقط
  stock_state      text not null default 'none'
                   check (stock_state in ('none','reserved','released')),

  -- ربط الطلب بحساب العميل — لا طلبات مجهولة
  customer_id      uuid references auth.users (id) on delete set null,
  customer_email   text,

  -- بنود الطلب كاملة (اسم، كمية، سعر لحظة البيع، الخيارات)
  items            jsonb not null default '[]'::jsonb
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_phone_idx      on public.orders (customer_phone);

-- ── الدفع (أُضيف بعد إطلاق أول نسخة — آمن للتشغيل المتكرر) ──
alter table public.orders
  add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid','pending','paid','failed','refunded'));

alter table public.orders add column if not exists payment_ref      text;
alter table public.orders add column if not exists payment_provider text;

-- إيصال التحويل البنكي (مسار داخل مخزن payment-proofs الخاص)
alter table public.orders add column if not exists payment_proof_path  text;
alter table public.orders add column if not exists payment_proof_at    timestamptz;
alter table public.orders add column if not exists payment_review_note text;

create index if not exists orders_payment_ref_idx on public.orders (payment_ref);

-- علامة تحرير المخزون — تمنع إرجاع الكميات مرتين عند تكرار الإلغاء
alter table public.orders
  add column if not exists stock_released boolean not null default false;

-- ── الهوية اليمنية + ربط العميل (009) ──────────────────────
alter table public.orders
  add column if not exists stock_state text not null default 'none';
alter table public.orders drop constraint if exists orders_stock_state_check;
alter table public.orders
  add constraint orders_stock_state_check
  check (stock_state in ('none','reserved','released'));

alter table public.orders add column if not exists customer_id uuid
  references auth.users (id) on delete set null;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists payment_method_id text;

alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders
  add constraint orders_payment_check
  check (payment in ('cod','transfer','wallet'));

create index if not exists orders_customer_idx    on public.orders (customer_id);
create index if not exists orders_stock_state_idx on public.orders (stock_state);

-- ═════════════════════════════════════════════════════════════
-- 4) حجز المخزون عند الطلب
--
-- لماذا دالة في قاعدة البيانات وليس قراءة/كتابة من التطبيق؟
-- لأن قراءتين متزامنتين كانتا ستقرآن نفس الرصيد ثم تبيعان نفس القطعة.
-- هنا الخصم والتحقق يحدثان في عبارة UPDATE واحدة، وأي طلب يتجاوز
-- الرصيد يرفع استثناءً فيتراجع كل شيء (PostgREST يغلّف كل طلب بمعاملة).
-- ═════════════════════════════════════════════════════════════
create or replace function public.reserve_stock(lines jsonb)
returns void
language plpgsql
security definer
as $$
declare
  line jsonb;
  v_id text;
  v_qty int;
  v_color text;
  v_tracked boolean;
  affected int;
begin
  for line in select * from jsonb_array_elements(lines)
  loop
    v_id := line->>'productId';
    v_qty := coalesce((line->>'qty')::int, 0);
    v_color := nullif(line->>'color', '');

    select exists (
      select 1
        from public.products p,
             jsonb_array_elements(case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end) as c
       where p.id = v_id
         and c->>'name' = v_color
         and c ? 'stock'
    ) into v_tracked;

    if v_color is not null and v_tracked then
      update public.products p
         set stock = p.stock - v_qty,
             colors = (
               select jsonb_agg(
                        case
                          when c->>'name' = v_color
                            then jsonb_set(c, '{stock}', to_jsonb(coalesce((c->>'stock')::int, 0) - v_qty))
                          else c
                        end
                        order by ord
                      )
                 from jsonb_array_elements(p.colors) with ordinality as t(c, ord)
             )
       where p.id = v_id
         and p.stock >= v_qty
         and exists (
           select 1
             from jsonb_array_elements(p.colors) as c
            where c->>'name' = v_color
              and coalesce((c->>'stock')::int, 0) >= v_qty
         );
    else
      update public.products
         set stock = stock - v_qty
       where id = v_id
         and stock >= v_qty;
    end if;

    get diagnostics affected = row_count;

    if affected = 0 then
      raise exception 'OUT_OF_STOCK:%', coalesce(v_id, '?');
    end if;
  end loop;
end;
$$;

-- إرجاع الكمية إن فشل حفظ الطلب بعد الحجز
create or replace function public.release_stock(lines jsonb)
returns void
language plpgsql
security definer
as $$
declare
  line jsonb;
  v_id text;
  v_qty int;
  v_color text;
  v_tracked boolean;
begin
  for line in select * from jsonb_array_elements(lines)
  loop
    v_id := line->>'productId';
    v_qty := coalesce((line->>'qty')::int, 0);
    v_color := nullif(line->>'color', '');

    select exists (
      select 1
        from public.products p,
             jsonb_array_elements(case when jsonb_typeof(p.colors) = 'array' then p.colors else '[]'::jsonb end) as c
       where p.id = v_id
         and c->>'name' = v_color
         and c ? 'stock'
    ) into v_tracked;

    if v_color is not null and v_tracked then
      update public.products p
         set stock = p.stock + v_qty,
             colors = (
               select jsonb_agg(
                        case
                          when c->>'name' = v_color
                            then jsonb_set(c, '{stock}', to_jsonb(coalesce((c->>'stock')::int, 0) + v_qty))
                          else c
                        end
                        order by ord
                      )
                 from jsonb_array_elements(p.colors) with ordinality as t(c, ord)
             )
       where p.id = v_id;
    else
      update public.products
         set stock = stock + v_qty
       where id = v_id;
    end if;
  end loop;
end;
$$;

-- تحرير مخزون طلب كامل مرة واحدة فقط (ذرّي).
-- يُستدعى عند إلغاء الطلب من لوحة التحكم، ويعمل فقط إن كان المخزون مخصوماً.
create or replace function public.release_order_stock(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
                   'color', it->>'color
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
$$;

-- تأكيد الطلب وخصم المخزون ذرّياً — يستدعيه المدير فقط.
-- إن نقصت أي قطعة يرفع OUT_OF_STOCK:<id> ولا يُخصم شيء.
create or replace function public.confirm_order_stock(p_order_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

  if v_status not in ('new','confirmed') then
    raise exception 'ORDER_NOT_CONFIRMABLE:%', v_status;
  end if;

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
$$;

-- إعادة حجز مخزون طلب أُلغي ثم أُعيد فتحه.
-- تخصم الكميات ذرّياً (مع اللون إن وُجد)، وترفع OUT_OF_STOCK:<id>
-- إن لم تكفِ الكمية (فتبقى كل التغييرات ملغاة والطلب ملغياً).
create or replace function public.reserve_order_stock(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  update public.orders
     set stock_released = false
   where id = p_order_id
     and stock_released = true
  returning items into v_items;

  if not found then
    return false;
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

  return true;
end;
$$;

-- إلغاء طلبات التحويل التي لم يُعتمد إيصالها خلال المهلة (افتراضياً 72 ساعة).
-- يُشغَّل دورياً عبر pg_cron، ويعيد عدد الطلبات التي أُلغيت.
create or replace function public.cancel_stale_transfer_orders(p_hours int default 72)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_count int := 0;
begin
  for v_id in
    select id
      from public.orders
     where payment = 'transfer'
       and payment_status <> 'paid'
       and status <> 'cancelled'
       and created_at < now() - make_interval(hours => greatest(coalesce(p_hours, 72), 1))
  loop
    update public.orders set status = 'cancelled' where id = v_id;
    perform public.release_order_stock(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ═════════════════════════════════════════════════════════════
-- 5) ملفات المستخدمين والأدوار
--
-- كل مستخدم في auth.users له صف واحد هنا يحدد نوعه:
--   admin    → يدير المتجر (لوحة التحكم)
--   customer → عميل عادي
--
-- الدور يُقرأ من الخادم فقط، ولا يُقبل من المتصفح.
-- ═════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  role        text not null default 'customer'
                check (role in ('admin','customer')),
  -- مزوّد الدخول: email / google / apple …
  provider    text not null default 'email',
  -- جوال العميل بصيغة يمنية + ملاحظة داخلية للمدير (009)
  phone       text,
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists admin_note text;

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- لا سياسات عامة: الوصول عبر service_role من الخادم فقط.

-- إنشاء الملف تلقائياً عند تسجيل أي مستخدم جديد.
-- الدور الافتراضي customer — ترقية المدير تتم يدوياً أو من الخادم.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, provider, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    case
      when coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then 'admin'
      else 'customer'
    end,
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 6) الحماية
-- الوصول عبر service_role فقط (من الخادم).
-- لا تُنشئ سياسة SELECT عامة — وإلا صارت بيانات العملاء مكشوفة.
-- ═════════════════════════════════════════════════════════════
alter table public.orders     enable row level security;
alter table public.products   enable row level security;
alter table public.categories enable row level security;

-- لا سياسات = لا وصول عبر anon key. الخادم يتجاوز RLS بمفتاح service_role
-- (أو عبر اتصال Postgres المباشر الذي يعمل بدور postgres).

-- ── صلاحيات الدوال ──────────────────────────────────────────
-- الدوال security definer قابلة للتنفيذ افتراضياً من PUBLIC. مع مفتاح anon
-- المنشور في المتصفح، كان أي زائر يستطيع استدعاء reserve_stock وتفريغ المخزون.
-- لذلك: أنكر التنفيذ على anon/authenticated وامنحه لـ service_role فقط.
revoke all on function public.reserve_stock(jsonb) from public, anon, authenticated;
revoke all on function public.release_stock(jsonb) from public, anon, authenticated;
revoke all on function public.release_order_stock(text) from public, anon, authenticated;
revoke all on function public.reserve_order_stock(text) from public, anon, authenticated;
revoke all on function public.confirm_order_stock(text) from public, anon, authenticated;
revoke all on function public.cancel_stale_transfer_orders(int) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.reserve_stock(jsonb) to service_role;
grant execute on function public.release_stock(jsonb) to service_role;
grant execute on function public.release_order_stock(text) to service_role;
grant execute on function public.reserve_order_stock(text) to service_role;
grant execute on function public.confirm_order_stock(text) to service_role;
grant execute on function public.cancel_stale_transfer_orders(int) to service_role;

alter function public.reserve_stock(jsonb) set search_path = public;
alter function public.release_stock(jsonb) set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- ── الجدولة (pg_cron) ───────────────────────────────────────
-- إلغاء طلبات التحويل غير المدفوعة كل ساعة (مهلة 72 ساعة من الإنشاء).
-- على Supabase: فعّل الامتداد من Database → Extensions ثم نفّذ:
create extension if not exists pg_cron;

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname = 'stor-cancel-stale-card-orders';
  if j is not null then perform cron.unschedule(j); end if;

  select jobid into j from cron.job where jobname = 'stor-cancel-stale-transfer-orders';
  if j is not null then perform cron.unschedule(j); end if;
end $$;

select cron.schedule(
  'stor-cancel-stale-transfer-orders',
  '10 * * * *',
  $$select public.cancel_stale_transfer_orders(72)$$
);

-- ═════════════════════════════════════════════════════════════
-- 7) إعدادات المتجر (الحساب البنكي) ومخزن الإيصالات
-- ═════════════════════════════════════════════════════════════
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

insert into public.settings (key, value)
values ('bank_transfer', jsonb_build_object(
  'bankName', '',
  'accountName', '',
  'iban', '',
  'note', ''
))
on conflict (key) do nothing;

-- طرق الدفع (009): قائمة يديرها المدير — بنوك ومحافظ محلية.
insert into public.settings (key, value)
values ('payment_methods', '[]'::jsonb)
on conflict (key) do nothing;

-- ── سلة العميل المسجّل (009) ────────────────────────────────
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

-- إضافة ذرّية: تزيد الكمية عند وجود نفس السطر بدل تكراره.
create or replace function public.cart_add(
  p_customer_id uuid,
  p_product_id  text,
  p_option      text,
  p_color       text,
  p_qty         integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_option text := coalesce(p_option, '');
  v_color  text := coalesce(p_color, '');
  v_qty    int  := greatest(coalesce(p_qty, 1), 1);
  v_lines  int;
  v_exists boolean;
begin
  if p_customer_id is null or p_product_id is null then
    raise exception 'CART_INVALID';
  end if;

  select exists (
    select 1 from public.customer_carts
     where customer_id = p_customer_id
       and product_id = p_product_id
       and option = v_option
       and color = v_color
  ) into v_exists;

  if not v_exists then
    select count(*) into v_lines
      from public.customer_carts
     where customer_id = p_customer_id;

    if v_lines >= 50 then
      raise exception 'CART_FULL';
    end if;
  end if;

  insert into public.customer_carts (customer_id, product_id, option, color, qty)
  values (p_customer_id, p_product_id, v_option, v_color, least(v_qty, 20))
  on conflict (customer_id, product_id, option, color) do update
    set qty = least(20, public.customer_carts.qty + excluded.qty),
        updated_at = now();
end;
$$;

revoke all on function public.cart_add(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.cart_add(uuid, text, text, text, integer)
  to service_role;

-- مخزن خاص لإيصالات التحويل — يُقرأ فقط بروابط موقّعة من الخادم.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- ═════════════════════════════════════════════════════════════
-- 8) معلومات المتجر + صور المنتجات + مخازن الصور العامة
--    (انظر supabase/migrations/008_*.sql للشرح الكامل)
-- ═════════════════════════════════════════════════════════════
alter table public.products add column if not exists image_path text;
alter table public.products
  add column if not exists color_images jsonb not null default '{}'::jsonb;

-- صور المنتجات (عام للقراءة، والرفع من لوحة المدير بمفتاح service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- bucket مستقل لشعار المتجر وأصوله.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets', 'store-assets', true, 2097152,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_assets_read on storage.objects;
create policy store_assets_read
  on storage.objects for select to public
  using (bucket_id = 'store-assets');

insert into public.settings (key, value)
values ('store_info', jsonb_build_object(
  'name', 'ستور', 'nameEn', 'STOOR',
  'welcomeLine1', 'بريقٌ يبقى،', 'welcomeLine2', 'ورائحةٌ تُذكر.',
  'workingHours', 'من 9 صباحاً إلى 9 مساءً، طوال أيام الأسبوع',
  'address', 'صنعاء، اليمن',
  'whatsapp', '967770000000',
  'phone', '+967 77 000 0000',
  'social', jsonb_build_object('instagram','','tiktok','','snapchat','','x',''),
  'logoPath', ''
))
on conflict (key) do nothing;
