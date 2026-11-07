-- ─────────────────────────────────────────────────────────────
-- 010 — سلة العميل: إضافة ذرّية بلا تكرار
-- آمن للتشغيل المتكرر (idempotent).
--
-- `cart_add` تزيد الكمية عند وجود نفس (المنتج/اللون/الخيار) بدل استبدالها،
-- وتمنع تجاوز ٢٠ قطعة للسطر و٥٠ سطراً للسلة.
-- ─────────────────────────────────────────────────────────────

begin;

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
set search_path to 'public'
as $function$
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
$function$;

revoke all on function public.cart_add(uuid, text, text, text, integer) from public;
revoke all on function public.cart_add(uuid, text, text, text, integer) from anon;
revoke all on function public.cart_add(uuid, text, text, text, integer) from authenticated;
grant execute on function public.cart_add(uuid, text, text, text, integer) to service_role;

commit;
