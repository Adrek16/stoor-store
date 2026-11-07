-- 006: روابط تلقائية رقمية للتصنيفات والمنتجات.
--
-- القاعدة:
--   رابط التصنيف  = قسم التصنيف + رقم متسلسل داخل القسم   (perfumes-1, accessories-4, general-1)
--   رابط المنتج   = رابط التصنيف + رقم متسلسل داخل التصنيف (perfumes-1-3)
--
-- الأرقام تُصرف من عدّاد ذرّي (slug_counters) ولا تُعاد بعد الحذف،
-- فلا يتكرر رابط أبداً. عند نقل تصنيف لقسم آخر أو نقل منتج لتصنيف آخر
-- يُصرف رقم جديد ويُسجَّل الرابط القديم في سجل التحويلات (تحويل 308 في المتجر).

/* ── 1) عدّاد الأرقام ─────────────────────────────────────── */

create table if not exists public.slug_counters (
  scope text primary key,
  value integer not null default 0,
  constraint slug_counters_value_check check (value >= 0)
);

alter table public.slug_counters enable row level security;

-- يصرف الرقم التالي لِـ scope: 1 لأول عنصر، ثم 2، 3...
create or replace function public.stoor_next_slug_seq(p_scope text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if p_scope is null or length(trim(p_scope)) = 0 then
    raise exception 'SCOPE_REQUIRED';
  end if;

  insert into public.slug_counters (scope, value)
  values (p_scope, 1)
  on conflict (scope) do update
    set value = public.slug_counters.value + 1
  returning value into v_next;

  return v_next;
end;
$$;

revoke all on function public.stoor_next_slug_seq(text) from public;
grant execute on function public.stoor_next_slug_seq(text) to service_role;

/* ── 2) سجل روابط المنتجات القديمة ────────────────────────── */

create table if not exists public.product_slug_history (
  old_slug text primary key,
  new_slug text not null,
  created_at timestamptz not null default now(),
  constraint product_slug_history_old_differs check (old_slug <> new_slug)
);

alter table public.product_slug_history enable row level security;

create index if not exists product_slug_history_new_slug_idx
  on public.product_slug_history (new_slug);

/* ── 3) أعمدة الأرقام ─────────────────────────────────────── */

alter table public.categories add column if not exists seq integer;
alter table public.products add column if not exists seq integer;

-- ترقيم التصنيفات داخل كل قسم حسب الترتيب الحالي.
with ordered as (
  select
    slug,
    coalesce(parent, 'general') as section,
    row_number() over (
      partition by coalesce(parent, 'general')
      order by sort_order, created_at, slug
    ) as rn
  from public.categories
)
update public.categories c
set seq = o.rn::integer
from ordered o
where c.slug = o.slug;

-- تسجيل الروابط القديمة قبل تغييرها.
insert into public.category_slug_history (old_slug, new_slug)
select
  c.slug,
  coalesce(c.parent, 'general') || '-' || c.seq
from public.categories c
where c.slug <> coalesce(c.parent, 'general') || '-' || c.seq
on conflict (old_slug) do update set new_slug = excluded.new_slug;

-- تغيير روابط التصنيفات (ينتقل تلقائياً إلى products.category عبر cascade).
update public.categories c
set slug = coalesce(c.parent, 'general') || '-' || c.seq;

-- ترقيم المنتجات داخل كل تصنيف حسب الترتيب الحالي.
with ordered as (
  select
    id,
    row_number() over (
      partition by category
      order by sort_order, created_at, id
    ) as rn
  from public.products
)
update public.products p
set seq = o.rn::integer
from ordered o
where p.id = o.id;

-- تسجيل روابط المنتجات القديمة.
insert into public.product_slug_history (old_slug, new_slug)
select
  p.slug,
  p.category || '-' || p.seq
from public.products p
where p.slug <> p.category || '-' || p.seq
on conflict (old_slug) do update set new_slug = excluded.new_slug;

update public.products p
set slug = p.category || '-' || p.seq;

/* ── 4) تهيئة العدّادات بقيم الترقيم الحالية ──────────────── */

insert into public.slug_counters (scope, value)
select 'category:' || coalesce(parent, 'general'), max(seq)
from public.categories
group by coalesce(parent, 'general')
on conflict (scope) do update
  set value = greatest(public.slug_counters.value, excluded.value);

insert into public.slug_counters (scope, value)
select 'product:' || category, max(seq)
from public.products
group by category
on conflict (scope) do update
  set value = greatest(public.slug_counters.value, excluded.value);

/* ── 5) قيود التفرد ───────────────────────────────────────── */

create unique index if not exists categories_section_seq_key
  on public.categories ((coalesce(parent, 'general')), seq)
  where seq is not null;

create unique index if not exists products_category_seq_key
  on public.products (category, seq)
  where seq is not null;

/* ── 6) نقل تصنيف إلى قسم آخر (ذرّي) ──────────────────────── */

drop function if exists public.stoor_move_category(text, text, text);

create or replace function public.stoor_move_category(
  p_old_slug text,
  p_new_slug text,
  p_new_parent text,
  p_new_seq integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.categories where slug = p_old_slug) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if exists (select 1 from public.categories where slug = p_new_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  -- سلاسل التحويل للمنتجات: القديم → الجديد، والسلاسل السابقة تُدمج.
  insert into public.product_slug_history (old_slug, new_slug)
  select p.slug, p_new_slug || '-' || p.seq
  from public.products p
  where p.category = p_old_slug
  on conflict (old_slug) do update set new_slug = excluded.new_slug;

  update public.product_slug_history h
  set new_slug = p_new_slug || '-' || p.seq
  from public.products p
  where h.new_slug = p.slug
    and p.category = p_old_slug;

  delete from public.product_slug_history h
  using public.products p
  where p.category = p_old_slug
    and h.old_slug = p_new_slug || '-' || p.seq;

  -- سجل التصنيف نفسه.
  update public.category_slug_history
  set new_slug = p_new_slug
  where new_slug = p_old_slug;

  delete from public.category_slug_history where old_slug = p_new_slug;

  insert into public.category_slug_history (old_slug, new_slug)
  values (p_old_slug, p_new_slug)
  on conflict (old_slug) do update set new_slug = excluded.new_slug;

  -- تغيير التصنيف (cascade يحدّث products.category).
  update public.categories
  set slug = p_new_slug,
      parent = p_new_parent,
      seq = p_new_seq
  where slug = p_old_slug;

  update public.products
  set slug = p_new_slug || '-' || seq
  where category = p_new_slug;

  -- عدّاد المنتجات في التصنيف الجديد يبدأ بعد أكبر رقم مستخدم.
  insert into public.slug_counters (scope, value)
  select 'product:' || p_new_slug, coalesce(max(seq), 0)
  from public.products
  where category = p_new_slug
  on conflict (scope) do update
    set value = greatest(public.slug_counters.value, excluded.value);

  return p_new_slug;
end;
$$;

revoke all on function public.stoor_move_category(text, text, text, integer) from public;
grant execute on function public.stoor_move_category(text, text, text, integer) to service_role;

/* ── 7) نقل منتج إلى تصنيف آخر (ذرّي) ─────────────────────── */

drop function if exists public.stoor_move_product(text, text, text);

create or replace function public.stoor_move_product(
  p_product_id text,
  p_new_category text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_slug text;
  v_new_slug text;
  v_seq integer;
begin
  select slug into v_old_slug from public.products where id = p_product_id;
  if v_old_slug is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_seq := public.stoor_next_slug_seq('product:' || p_new_category);
  v_new_slug := p_new_category || '-' || v_seq;

  update public.product_slug_history
  set new_slug = v_new_slug
  where new_slug = v_old_slug;

  delete from public.product_slug_history where old_slug = v_new_slug;

  insert into public.product_slug_history (old_slug, new_slug)
  values (v_old_slug, v_new_slug)
  on conflict (old_slug) do update set new_slug = excluded.new_slug;

  update public.products
  set category = p_new_category,
      slug = v_new_slug,
      seq = v_seq
  where id = p_product_id;

  return v_new_slug;
end;
$$;

revoke all on function public.stoor_move_product(text, text) from public;
grant execute on function public.stoor_move_product(text, text) to service_role;

/* ── 8) حذف حقل الاسم الإنجليزي للمنتج ────────────────────── */

alter table public.products drop column if exists name_en;
