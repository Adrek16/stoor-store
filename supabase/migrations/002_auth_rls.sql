-- ─────────────────────────────────────────────────────────────
-- 002 — المصادقة والسياسات: RLS + أدوار في app_metadata
-- ─────────────────────────────────────────────────────────────
-- نفّذه بعد 001 (schema.sql):
--   node scripts/db-sql.mjs --file supabase/migrations/002_auth_rls.sql
-- أو عبر: npm run db:migrate
--
-- الفكرة:
--   1. الدور权威 يتحوّل إلى `auth.users.raw_app_meta_data` — وهو المكان
--      الذي لا يستطيع المستخدم تعديله (بعكس user_metadata). هذا هو
--      الأسلوب الرسمي الذي توصي به Supabase للأدوار.
--   2. سياسات RLS تجعل القاعدة هي من يفرض الوصول: الكتالوج مقروء
--      للعموم، والطلبات.Profile يقرأ صاحبها فقط.
--   3. لا سياسات كتابة لـ anon/authenticated إطلاقاً — كل الكتابة من
--      الخادم بـ service_role، فلا يمكن تجاوز إعادة حساب الأسعار.
--
-- آمن للتشغيل المتكرر (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- 1) ربط الطلبات بحساب العميل
-- ═════════════════════════════════════════════════════════════
-- customer_id: Allows the customer to see their own orders in /account.
alter table public.orders
  add column if not exists customer_id uuid references auth.users (id) on delete set null;

alter table public.orders
  add column if not exists customer_email text;

create index if not exists orders_customer_id_idx on public.orders (customer_id);

-- ═════════════════════════════════════════════════════════════
-- 2) دالة is_admin() — المصدر الرسمي للدور
-- ═════════════════════════════════════════════════════════════
-- تقرأ app_metadata (لا user_metadata) — فلا يستطيع العميل الترقية
-- لنفسه بتعديل ملفه الشخصي.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = auth.uid()
       and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ═════════════════════════════════════════════════════════════
-- 3) مزامنة profiles.role مع app_metadata
-- ═════════════════════════════════════════════════════════════
-- عند إنشاء مستخدم جديد: app_metadata.role هو المرجع (admin أو customer).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, provider, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    case
      when coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then 'admin'
      else 'customer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- عند ترقية دور مستخدم من لوحة Supabase: حدّث profiles.role أيضاً.
create or replace function public.sync_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role = case
                  when coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then 'admin'
                  else 'customer'
                end
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role();

-- ═════════════════════════════════════════════════════════════
-- 4) منع تصعيد الصلاحيات عبر profiles
-- ═════════════════════════════════════════════════════════════
-- سياسة "يعدّل ملفه" تسمح بتحديث role — لذا نضع حاجزاً في القاعدة:
-- لا يُغيَّر الدور إلا من service_role أو من مدير.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_claims text;
  v_claim_role text;
begin
  if new.role is distinct from old.role then
    v_claims := nullif(current_setting('request.jwt.claims', true), '');
    v_claim_role := case
      when v_claims is null then ''
      else coalesce(v_claims::jsonb ->> 'role', '')
    end;

    if v_claim_role <> 'service_role' and not public.is_admin() then
      raise exception 'profiles.role: لا يُسمح بتغيير الدور'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ═════════════════════════════════════════════════════════════
-- 5) سياسات RLS
-- ═════════════════════════════════════════════════════════════
-- ملاحظة مهمة: لا نضع أي سياسة كتابة لـ anon أو authenticated.
-- الكتابة كلها تمرّ من الخادم بـ service_role، وهذا ما يحمي إعادة
-- حساب الأسعار (لا يُقبل أي إجمالي من العميل).
-- ═════════════════════════════════════════════════════════════

-- ── التصنيفات: مقروءة للجميع (قائمة المتجر) ──
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);

-- ── المنتجات: المقروءة للجميع هي النشطة فقط ──
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated
  using (active = true);

-- ── الملف الشخصي: صاحب الحساب فقط ──
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── الطلبات: صاحب الطلب فقط (أو المدير) ──
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

-- ═════════════════════════════════════════════════════════════
-- 6) مساحة تخزين صور المنتجات
-- ═════════════════════════════════════════════════════════════
-- الطريقة الرسمية لخدمة صور المنتجات من Supabase بدل SVG المولّد.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
  for select to public
  using (bucket_id = 'product-images');

drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
