-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
-- 004 â€” ظ…ط®ط²ظˆظ† ظ„ظƒظ„ ظ„ظˆظ†
--
-- colors ظٹطµط¨ط­: [{ "name": "ط°ظ‡ط¨ظٹ", "hex": "#d4a857", "stock": 12 }]
-- ظˆproducts.stock ظٹط¨ظ‚ظ‰ ط§ظ„ظ…ط¬ظ…ظˆط¹ ط§ظ„ظƒظ„ظٹ (ظٹطھط­ط¯ط« ظ…ط¹ ظƒظ„ ط­ط¬ط²/طھط­ط±ظٹط±).
--
-- ط§ظ„ط®ط·ظˆط§طھ:
--   1) طھظˆط²ظٹط¹ ط§ظ„ظ…ط®ط²ظˆظ† ط§ظ„ط­ط§ظ„ظٹ ط¹ظ„ظ‰ ط£ظ„ظˆط§ظ† ط§ظ„ظ…ظ†طھط¬ط§طھ ط§ظ„ظ‚ط¯ظٹظ…ط© (ط¨ط§ظ„طھط³ط§ظˆظٹ).
--   2) ط¬ط¹ظ„ reserve/release ظˆط§ط¹ظٹظٹظ† ظ„ظ„ظˆظ† ط¹ظ†ط¯ ظˆط¬ظˆط¯ظ‡.
--
-- ط§ظ„ط£ظ„ظˆط§ظ† ط§ظ„ظ‚ط¯ظٹظ…ط© ط¨ظ„ط§ stock طھط¨ظ‚ظ‰ طھط¹ظ…ظ„ ط¨ط§ظ„ظ…ط®ط²ظˆظ† ط§ظ„ظƒظ„ظٹ ط­طھظ‰ طھظڈط­ظپط¸ ظ…ظ† ظ„ظˆط­ط© ط§ظ„ظ…ط¯ظٹط±.
-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

-- 1) طھظˆط²ظٹط¹ ط§ظ„ظ…ط®ط²ظˆظ† ط§ظ„ط­ط§ظ„ظٹ ط¹ظ„ظ‰ ط§ظ„ط£ظ„ظˆط§ظ† â€” ظ…ط±ط© ظˆط§ط­ط¯ط© ظپظ‚ط·.
do $$
declare
  p record;
  n int;
  base int;
  extra int;
begin
  for p in
    select id, stock, colors
      from public.products
     where jsonb_typeof(colors) = 'array'
       and jsonb_array_length(colors) > 0
       and not exists (
         select 1
           from jsonb_array_elements(products.colors) as c
          where c ? 'stock'
       )
  loop
    n := jsonb_array_length(p.colors);
    base := p.stock / n;
    extra := p.stock % n;

    update public.products
       set colors = (
         select jsonb_agg(
                  (c - 'stock') || jsonb_build_object(
                    'stock',
                    base + case when ord <= extra then 1 else 0 end
                  )
                  order by ord
                )
           from jsonb_array_elements(p.colors) with ordinality as t(c, ord)
       )
     where id = p.id;
  end loop;
end $$;

-- 2) ط­ط¬ط² ط§ظ„ظ…ط®ط²ظˆظ†: ظٹط®طµظ… ظ…ظ† ط§ظ„ظ„ظˆظ† ط§ظ„ظ…ط·ظ„ظˆط¨ ظˆظ…ظ† ط§ظ„ظ…ط¬ظ…ظˆط¹ ظپظٹ ظ†ظپط³ ط§ظ„طھط­ط¯ظٹط«.
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

-- 3) طھط­ط±ظٹط± ط§ظ„ظ…ط®ط²ظˆظ†: ظٹط¹ظٹط¯ ط§ظ„ظƒظ…ظٹط© ط¥ظ„ظ‰ ط§ظ„ظ„ظˆظ† ظˆط§ظ„ظ…ط¬ظ…ظˆط¹.
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

-- 4) ط¥ط¹ط§ط¯ط© ظپطھط­ ط·ظ„ط¨ ظ…ظ„ط؛ظٹ: ظٹط¹ظٹط¯ ط§ط³طھط®ط¯ط§ظ… reserve_stock ط¨ط¹ط¯ طھط¬ظ‡ظٹط² ط§ظ„ط³ط·ظˆط± ط¨ط§ظ„ظ„ظˆظ†.
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

-- 5) ط¥ظ„ط؛ط§ط، ط·ظ„ط¨: ظٹط¹ظٹط¯ ط§ظ„ظƒظ…ظٹط§طھ ظ…ط¹ ط£ظ„ظˆط§ظ†ظ‡ط§.
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
     set stock_released = true
   where id = p_order_id
     and stock_released = false
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
$$;
