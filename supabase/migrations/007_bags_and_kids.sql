-- 007: قسم الحقائب + جنس الأطفال.
--
-- المدير يعرض الأقسام الرئيسية من قائمة ثابتة، وأضفنا إليها «bags».
-- هذا الملف يوسّع قيود الجنس في قاعدة البيانات لتقبل 'kids'، فلا يرفض
-- الخادم منتجاً/تصنيفاً اختاره المدير من الواجهة.

alter table public.categories
  drop constraint if exists categories_gender_check;

alter table public.categories
  add constraint categories_gender_check
  check (gender is null or gender in ('men', 'women', 'unisex', 'kids'));

alter table public.products
  drop constraint if exists products_gender_check;

alter table public.products
  add constraint products_gender_check
  check (gender in ('men', 'women', 'unisex', 'kids'));
