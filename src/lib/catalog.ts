import { cacheLife, cacheTag } from "next/cache";
import { categories as seedCategories } from "./categories";
import { products as seedProducts } from "./products";
import { hasSupabase, isMissingTable, sbSelect } from "./supabase";
import { rowToCategory, rowToProduct, type CategoryRow, type ProductRow } from "./catalog-ops";
import type { Category, Product } from "./types";

/**
 * مصدر الكتالوج الوحيد للخادم.
 *
 * - عند ضبط مفاتيح Supabase: يقرأ من الجدولين `products` و`categories`.
 * - عند غيابها: يعمل على البيانات المحلية في `lib/products.ts` كما هو.
 * - عند فشل القراءة (جدول غير موجود / شبكة): يرجع للبيانات المحلية
 *   بدل إسقاط المتجر — والموقع يظل يعمل.
 *
 * القراءة مُخزَّنة بالوسم `catalog` — أي تعديل إداري يستدعي
 * `revalidateTag("catalog")` فتظهر النتيجة في الطلب التالي.
 */

export type CatalogSource = "supabase" | "seed";

export type Catalog = {
  products: Product[];
  categories: Category[];
  source: CatalogSource;
};

export const CATALOG_TAG = "catalog";

const PRODUCT_FIELDS = [
  "id",
  "slug",
  "name",
  "subtitle",
  "category",
  "gender",
  "price",
  "compare_at",
  "rating",
  "reviews",
  "sales_count",
  "popularity_score",
  "badge",
  "artwork",
  "tone",
  "options",
  "colors",
  "image_path",
  "color_images",
  "notes",
  "description",
  "features",
  "stock",
  "active",
].join(",");

const CATEGORY_FIELDS = ["slug", "name", "name_en", "parent", "gender", "blurb"].join(",");

const seedCatalog: Catalog = {
  products: seedProducts,
  categories: seedCategories,
  source: "seed",
};

/** قراءة مباشرة بلا تخزين — تستخدمها لوحة التحكم لرؤية أحدث البيانات دائماً. */
export async function readCatalogFromDb(
  options: { includeInactive?: boolean } = {}
): Promise<Catalog> {
  if (!hasSupabase) return seedCatalog;

  const activeFilter = options.includeInactive ? "" : "&active=eq.true";

  const [categoryRows, productRows] = await Promise.all([
    sbSelect<CategoryRow>("categories", `select=${CATEGORY_FIELDS}&order=sort_order.asc`),
    sbSelect<ProductRow>(
      "products",
      `select=${PRODUCT_FIELDS}&order=sort_order.asc${activeFilter}`
    ),
  ]);

  return {
    products: productRows.map(rowToProduct),
    categories: categoryRows.map(rowToCategory),
    source: "supabase",
  };
}

/** الكتالوج المخزَّن الذي تقرأه كل صفحات المتجر. */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(CATALOG_TAG);
  // دقيقة واحدة بدل ساعة: تعديل الصفوف من Supabase مباشرة (أو من زرع خارجي)
  // يظهر خلال دقيقة دون الحاجة لإعادة تشغيل الموقع. تعديلات اللوحة ما زالت
  // فورية لأنها تستدعي revalidateTag.
  cacheLife("minutes");

  if (!hasSupabase) return seedCatalog;

  try {
    return await readCatalogFromDb();
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn(
        "[catalog] جدول products/categories غير موجود بعد — نفّذ supabase/schema.sql. " +
          "المتجر يعمل مؤقتاً على البيانات المحلية."
      );
    } else {
      console.error(
        "[catalog] تعذّرت القراءة من Supabase — تم الرجوع للبيانات المحلية:",
        err instanceof Error ? err.message : err
      );
    }
    return seedCatalog;
  }
}

/** المنتجات فقط — اختصار شائع. */
export async function getProducts(): Promise<Product[]> {
  return (await getCatalog()).products;
}

/** التصنيفات فقط. */
export async function getCategories(): Promise<Category[]> {
  return (await getCatalog()).categories;
}
