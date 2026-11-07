/**
 * روابط كائنات Supabase Storage العامة.
 *
 * يُستخدم في مكوّنات الخادم والعميل معاً، لذلك يعتمد على المتغير المنشور
 * `NEXT_PUBLIC_SUPABASE_URL` (عنوان المشروع فقط، ليس مفتاحاً سرياً).
 * لا تُخزَّن هنا أي مفاتيح — الرفع يتم من لوحة المدير بمفتاح service_role.
 */

const BASE = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
).replace(/\/$/, "");

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const STORE_ASSETS_BUCKET = "store-assets";

/** رابط عام لكائن داخل bucket عام، أو null إن لم يُضبط العنوان/المسار. */
export function publicObjectUrl(bucket: string, path?: string | null): string | null {
  const clean = String(path ?? "").trim().replace(/^\/+/, "");
  if (!BASE || !clean) return null;

  const encoded = clean
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${BASE}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
}

export const productImageUrl = (path?: string | null) =>
  publicObjectUrl(PRODUCT_IMAGES_BUCKET, path);

export const storeAssetUrl = (path?: string | null) =>
  publicObjectUrl(STORE_ASSETS_BUCKET, path);
