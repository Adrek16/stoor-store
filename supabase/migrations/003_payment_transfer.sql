-- 003: إزالة دفع البطاقة وإضافة التحويل البنكي بإيصال + إعدادات الحساب البنكي
-- مطبّق على المشروع عبر MCP باسم: payment_transfer_settings_and_hardening
--
-- يتضمن:
--   1. جدول settings (مفتاح/قيمة JSONB) — بيانات الحساب البنكي تُعدّل من لوحة المدير.
--   2. أعمدة إيصال التحويل في orders + توسيع allowed payment.
--   3. مخزن payment-proofs خاص + دالة الإلغاء التلقائي بعد 72 ساعة + مهمة pg_cron.
--   4. تقوية صلاحيات دوال الملفات الشخصية (تحذيرات Advisors).

begin;

-- ── 1) إعدادات المتجر (رقم الحساب البنكي) ──────────────────────────
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
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

-- ── 2) الطلبات: طريقة دفع تحويل + إيصال ────────────────────────────
alter table public.orders add column if not exists payment_proof_path text;
alter table public.orders add column if not exists payment_proof_at timestamptz;
alter table public.orders add column if not exists payment_review_note text;

alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders add constraint orders_payment_check
  check (payment in ('cod', 'card', 'transfer'));

-- ── 3) مخزن إيصالات التحويل (خاص) ──────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- ── 4) إلغاء طلبات التحويل غير المدفوعة بعد 72 ساعة ────────────────
create or replace function public.cancel_stale_transfer_orders(p_hours integer default 72)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

revoke all on function public.cancel_stale_transfer_orders(integer) from public;
revoke all on function public.cancel_stale_transfer_orders(integer) from anon;
revoke all on function public.cancel_stale_transfer_orders(integer) from authenticated;

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
  'select public.cancel_stale_transfer_orders(72)'
);

-- ── 5) تقوية الدوال (Advisors) ─────────────────────────────────────
revoke execute on function public.sync_profile_role() from public;
revoke execute on function public.sync_profile_role() from anon;
revoke execute on function public.sync_profile_role() from authenticated;

revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.touch_updated_at() from anon;
revoke execute on function public.touch_updated_at() from authenticated;

revoke execute on function public.guard_profile_role() from public;
revoke execute on function public.guard_profile_role() from anon;
revoke execute on function public.guard_profile_role() from authenticated;

revoke execute on function public.is_admin() from anon;

alter function public.touch_updated_at() set search_path = '';
alter function public.sync_profile_role() set search_path = 'public';
alter function public.guard_profile_role() set search_path = 'public';

commit;
