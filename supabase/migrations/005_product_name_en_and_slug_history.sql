-- 005: الاسم الإنجليزي للمنتج + سجل روابط التصنيفات القديمة.
--
-- name_en: يُستخدم في لوحة المدير لتوليد رابط المنتج تلقائياً،
--          ويمكن أن يبقى فارغاً؛ لا يقرأه المتجر.
--
-- category_slug_history: عند تغيير رابط تصنيف من لوحة المدير يُسجَّل
--   old_slug → new_slug، فيحوّل المتجر الروابط القديمة تحويلاً دائماً (308/301).
--   الصف يُحذف إذا أُنشئ تصنيف جديد بالرابط القديم، حتى لا يُحوَّل رابط حيّ.

alter table public.products add column if not exists name_en text;

comment on column public.products.name_en is
  'الاسم الإنجليزي — يُستخدم لتوليد رابط المنتج تلقائياً في لوحة المدير';

create table if not exists public.category_slug_history (
  old_slug text primary key,
  new_slug text not null,
  created_at timestamptz not null default now(),
  constraint category_slug_history_old_differs check (old_slug <> new_slug)
);

alter table public.category_slug_history enable row level security;

comment on table public.category_slug_history is
  'روابط التصنيفات القديمة — يحوّلها المتجر تحويلاً دائماً إلى الرابط الجديد';
