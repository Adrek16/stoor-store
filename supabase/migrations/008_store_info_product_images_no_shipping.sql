-- ─────────────────────────────────────────────────────────────
-- 008 — معلومات المتجر + صور المنتجات + إزالة الشحن/التوصيل نهائياً
-- آمن للتشغيل المتكرر (idempotent).
-- ─────────────────────────────────────────────────────────────

-- 1) صور المنتجات: صورة رئيسية + حتى 5 صور لكل لون داخل bucket product-images
alter table public.products
  add column if not exists image_path text;

alter table public.products
  add column if not exists color_images jsonb not null default '{}'::jsonb;

alter table public.products drop constraint if exists products_color_images_object;
alter table public.products
  add constraint products_color_images_object
  check (jsonb_typeof(color_images) = 'object');

comment on column public.products.image_path is
  'مسار الصورة الرئيسية داخل bucket product-images (مثال: products/<scope>/main-xxx.webp)';
comment on column public.products.color_images is
  'كائن { "اسم اللون": ["مسار", ...] } بحد أقصى 5 مسارات لكل لون داخل bucket product-images';

-- 2) إزالة الشحن والتوصيل بالكامل من الطلبات
--    الطلبات القديمة بحالتي shipped/delivered تُوحَّد إلى confirmed قبل تغيير القيد.
update public.orders set status = 'confirmed' where status in ('shipped', 'delivered');

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders alter column status set default 'new';
alter table public.orders
  add constraint orders_status_check
  check (status in ('new', 'confirmed', 'completed', 'cancelled'));

alter table public.orders drop column if exists shipping;
alter table public.orders drop column if exists shipping_method;
alter table public.orders drop column if exists cod_fee;
alter table public.orders drop column if exists city;
alter table public.orders drop column if exists address;

-- 3) bucket جديد خاص بشعار المتجر وأصوله (عام للقراءة، والرفع من الخادم فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets', 'store-assets', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_assets_read on storage.objects;
create policy store_assets_read
  on storage.objects for select to public
  using (bucket_id = 'store-assets');

-- 4) تأكيد إعدادات bucket صور المنتجات الموجود
update storage.buckets
   set public = true,
       file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
 where id = 'product-images';

-- 5) القيم الافتراضية لمعلومات المتجر — مستخرجة من شاشات العملاء
insert into public.settings (key, value)
values (
  'store_info',
  jsonb_build_object(
    'name',         'ستور',
    'nameEn',       'STOOR',
    'tagline',      'عطور وإكسسوارات وحقائب — رجالي ونسائي وأطفال',
    'description',  'متجر ستور للعطور والإكسسوارات والحقائب. عطور شرقية وفرنسية، سلاسل وأقراط وخواتم وساعات وحقائب، بجودة عالية واختيار بعناية.',
    'about',        'عطور شرقية وفرنسية وإكسسوارات مختارة بعناية — للرجال والنساء. جودة نتحمّل مسؤوليتها، وتغليف يليق بالهدية.',
    'welcomeLine1', 'بريقٌ يبقى،',
    'welcomeLine2', 'ورائحةٌ تُذكر.',
    'welcomeBody',  'قطع مختارة بعناية من العطور الشرقية والفرنسية، والإكسسوارات المعدنية، والحقائب الأنيقة — للرجال والنساء والأطفال. جودة نتحمّل مسؤوليتها، وتغليف يليق بالهدية.',
    'workingHours', 'من 9 صباحاً إلى 9 مساءً، طوال أيام الأسبوع',
    'address',      'الرياض، المملكة العربية السعودية',
    'mapUrl',       '',
    'whatsapp',     '966500000000',
    'phone',        '+966 50 000 0000',
    'email',        'hello@stoor.example',
    'social',       jsonb_build_object(
      'instagram', '', 'tiktok', '', 'snapchat', '', 'x', ''
    ),
    'logoPath',     ''
  )
)
on conflict (key) do nothing;
