-- ─────────────────────────────────────────────────────────────
-- 011 — تقييمات العملاء + المبيعات المحسوبة + ملاحظة المدير
-- آمن للتشغيل المتكرر (idempotent).
--
-- يتضمن:
--   1. orders.admin_note — ملاحظة داخلية للمدير.
--   2. products.sales_count · products.popularity_score — محسوبة من الطلبات.
--   3. product_reviews — تقييم واحد لكل عميل/منتج، بمراجعة المدير.
--   4. refresh_product_rating — كاش التقييم من المعتمدة فقط.
--   5. recount_product_sales — إعادة حساب المبيعات عند تغيّر حالة الطلب.
-- ─────────────────────────────────────────────────────────────

begin;

-- ── 1) ملاحظة داخلية على الطلب ──────────────────────────────
alter table public.orders add column if not exists admin_note text;

comment on column public.orders.admin_note is
  'ملاحظة داخلية للمدير — لا تظهر للعميل';

-- ── 2) أعمدة محسوبة على المنتج ──────────────────────────────
alter table public.products
  add column if not exists sales_count integer not null default 0;

alter table public.products
  add column if not exists popularity_score numeric not null default 0;

comment on column public.products.sales_count is
  'الوحدات المباعة من الطلبات المؤكدة/المكتملة — تُحسب آلياً';
comment on column public.products.popularity_score is
  'درجة الترتيب = المبيعات + التقييم المرجّح — تُحسب آلياً';

-- ── 3) تقييمات العملاء ──────────────────────────────────────
create table if not exists public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    text not null references public.products (id) on delete cascade,
  customer_id   uuid not null references auth.users (id) on delete cascade,
  order_id      text references public.orders (id) on delete set null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text not null default '',
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  manager_reply text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, customer_id)
);

create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id);
create index if not exists product_reviews_customer_idx
  on public.product_reviews (customer_id);
create index if not exists product_reviews_status_idx
  on public.product_reviews (status, created_at desc);

alter table public.product_reviews enable row level security;

-- لا سياسات عامة: القراءة/الكتابة عبر الخادم بمفتاح service_role فقط.

drop trigger if exists product_reviews_touch_updated_at on public.product_reviews;
create trigger product_reviews_touch_updated_at
  before update on public.product_reviews
  for each row execute function public.touch_updated_at();

-- ── 4) كاش التقييم: من المعتمدة فقط ─────────────────────────
create or replace function public.refresh_product_rating(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_avg   numeric;
  v_count int;
begin
  select coalesce(avg(rating), 0), count(*)
    into v_avg, v_count
    from public.product_reviews
   where product_id = p_product_id
     and status = 'approved';

  update public.products
     set rating = round(v_avg::numeric, 1),
         reviews = v_count,
         popularity_score = sales_count + round(v_avg::numeric, 1) * 2
   where id = p_product_id;
end;
$function$;

-- ── 5) إعادة حساب المبيعات عند تغيّر حالة الطلب ─────────────
create or replace function public.recount_product_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ids text[];
begin
  select array_agg(distinct value)
    into v_ids
    from (
      select it->>'productId' as value
        from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it
       where it ? 'productId'
      union
      select it->>'productId'
        from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) it
       where it ? 'productId'
    ) ids
   where value is not null;

  if v_ids is null then
    return new;
  end if;

  update public.products p
     set sales_count = coalesce(
           (
             select sum(greatest((it->>'qty')::int, 0))
               from public.orders o
               cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
              where o.status in ('confirmed', 'completed')
                and it->>'productId' = p.id
                and (it->>'qty') ~ '^[0-9]+$'
           ),
           0
         ),
         popularity_score = coalesce(
           (
             select sum(greatest((it->>'qty')::int, 0))
               from public.orders o
               cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
              where o.status in ('confirmed', 'completed')
                and it->>'productId' = p.id
                and (it->>'qty') ~ '^[0-9]+$'
           ),
           0
         ) + round(p.rating::numeric, 1) * 2
   where p.id = any(v_ids);

  return new;
end;
$function$;

drop trigger if exists orders_recount_product_sales on public.orders;
create trigger orders_recount_product_sales
  after insert or update of status, items on public.orders
  for each row execute function public.recount_product_sales();

-- تعبئة أولية من الطلبات القائمة.
update public.products p
   set sales_count = coalesce(
         (
           select sum(greatest((it->>'qty')::int, 0))
             from public.orders o
             cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
            where o.status in ('confirmed', 'completed')
              and it->>'productId' = p.id
              and (it->>'qty') ~ '^[0-9]+$'
         ),
         0
       ),
       popularity_score = coalesce(
         (
           select sum(greatest((it->>'qty')::int, 0))
             from public.orders o
             cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
            where o.status in ('confirmed', 'completed')
              and it->>'productId' = p.id
              and (it->>'qty') ~ '^[0-9]+$'
         ),
         0
       ) + round(p.rating::numeric, 1) * 2;

revoke all on function public.refresh_product_rating(text) from public, anon, authenticated;
revoke all on function public.recount_product_sales() from public, anon, authenticated;
grant execute on function public.refresh_product_rating(text) to service_role;

commit;
