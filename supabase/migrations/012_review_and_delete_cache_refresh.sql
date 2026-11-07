-- ─────────────────────────────────────────────────────────────
-- 012 — تحديث الكاش تلقائياً عند حذف التقييمات أو الطلبات
--
-- المشكلة:
--   1. `recount_product_sales` كان مرتبطاً بـ INSERT و UPDATE فقط،
--      فحذف طلب مؤكد يترك `sales_count` مرتفعاً بلا تصحيح.
--   2. لم يكن هناك أي trigger على `product_reviews`، فحذف تقييم معتمد
--      أو تعديله لا يعيد حساب `rating` و`reviews` في `products`.
--
-- الحل:
--   1. تعديل `recount_product_sales` ليتعامل مع DELETE (NEW غير موجود).
--   2. إضافة trigger على `product_reviews` بعد INSERT/UPDATE/DELETE
--      يستدعي `refresh_product_rating` للمنتج المتأثر.
--   3. إعادة حساب كل الكاشات مرة واحدة لضمان اتساق البيانات الحالية.
-- ─────────────────────────────────────────────────────────────

begin;

-- 1) دالة عدد المبيعات — تدعم DELETE الآن ─────────────────────
create or replace function public.recount_product_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ids       text[];
  v_new_items jsonb;
  v_old_items jsonb;
begin
  -- NEW متاح في INSERT/UPDATE فقط، وOLD في UPDATE/DELETE فقط.
  if tg_op <> 'DELETE' then
    v_new_items := coalesce(new.items, '[]'::jsonb);
  end if;
  if tg_op <> 'INSERT' then
    v_old_items := coalesce(old.items, '[]'::jsonb);
  end if;

  select array_agg(distinct value)
    into v_ids
    from (
      select it->>'productId' as value
        from jsonb_array_elements(coalesce(v_new_items, '[]'::jsonb)) it
       where it ? 'productId'
      union
      select it->>'productId'
        from jsonb_array_elements(coalesce(v_old_items, '[]'::jsonb)) it
       where it ? 'productId'
    ) ids
   where value is not null;

  if v_ids is null then
    return null;
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

  return null;
end;
$function$;

drop trigger if exists orders_recount_product_sales on public.orders;
create trigger orders_recount_product_sales
  after insert or delete or update of status, items on public.orders
  for each row execute function public.recount_product_sales();

-- 2) تقييمات المنتجات — تحديث كاش المنتج بعد أي تغيير ─────────
create or replace function public.product_reviews_sync_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);

  -- لو نُقل التقييم إلى منتج آخر، نحدّث المنتج القديم أيضاً.
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    perform public.refresh_product_rating(old.product_id);
  end if;

  return new;
end;
$function$;

drop trigger if exists product_reviews_sync_rating on public.product_reviews;
create trigger product_reviews_sync_rating
  after insert or delete or update of status, rating, product_id on public.product_reviews
  for each row execute function public.product_reviews_sync_product_rating();

revoke all on function public.product_reviews_sync_product_rating()
  from public, anon, authenticated;

-- 3) إعادة حساب كل الكاشات مرة واحدة ─────────────────────────
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
       );

update public.products p
   set rating = coalesce(
         (
           select round(avg(r.rating)::numeric, 1)
             from public.product_reviews r
            where r.product_id = p.id and r.status = 'approved'
         ),
         0
       ),
       reviews = coalesce(
         (
           select count(*)
             from public.product_reviews r
            where r.product_id = p.id and r.status = 'approved'
         ),
         0
       ),
       popularity_score = p.sales_count + coalesce(
         (
           select round(avg(r.rating)::numeric, 1)
             from public.product_reviews r
            where r.product_id = p.id and r.status = 'approved'
         ),
         0
       ) * 2;

commit;
