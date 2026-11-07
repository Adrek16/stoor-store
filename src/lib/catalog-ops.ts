import type { ArtworkKind, Badge, Category, Gender, Product } from "./types";

/**
 * عمليات قراءة/ترتيب/بحث **نقية** على قائمة منتجات.
 *
 * لماذا دوال تأخذ القائمة كوسيط بدل الاعتماد على مصفوفة مستوردة؟
 * لأن القائمة قد تأتي من قاعدة البيانات أو من البيانات المحلية — والواجهة
 * يجب ألا تعرف الفرق. هذه الدوال لا تلمس أي مصدر بيانات.
 */

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "الأكثر رواجاً" },
  { value: "price-asc", label: "السعر: من الأقل" },
  { value: "price-desc", label: "السعر: من الأعلى" },
  { value: "rating", label: "الأعلى تقييماً" },
];

export const isSortKey = (value: unknown): value is SortKey =>
  value === "featured" || value === "price-asc" || value === "price-desc" || value === "rating";

export const findProduct = (list: Product[], slug: string) =>
  list.find((p) => p.slug === slug);

export const findProductById = (list: Product[], id: string) =>
  list.find((p) => p.id === id);

export const productsInCategory = (list: Product[], slug: string) =>
  list.filter((p) => p.category === slug);

export const productsByGender = (list: Product[], gender: Gender) =>
  list.filter((p) => p.gender === gender);

/**
 * تقييم مرجّح (Bayesian) يمنع منتجاً بتقييم واحد من تصدّر «الأعلى تقييماً».
 * المنتجات بلا مراجعات تبقى في النهاية بدرجة صفر.
 */
const RATING_PRIOR_COUNT = 3;
const RATING_PRIOR_VALUE = 4;

export function ratingScore(product: Product): number {
  const reviews = Math.max(0, Number(product.reviews) || 0);
  if (reviews === 0) return 0;
  const rating = Math.max(0, Math.min(5, Number(product.rating) || 0));
  return (
    (reviews * rating + RATING_PRIOR_COUNT * RATING_PRIOR_VALUE) /
    (reviews + RATING_PRIOR_COUNT)
  );
}

/** الأكثر مبيعاً — من مبيعات مؤكدة حقيقية فقط، وليس من عدد المراجعات. */
export const bestSellers = (list: Product[], limit = 8) =>
  list
    .filter((p) => (p.salesCount ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
        (b.salesCount ?? 0) - (a.salesCount ?? 0) ||
        ratingScore(b) - ratingScore(a)
    )
    .slice(0, limit);

/**
 * بديل «الأكثر مبيعاً» حين لا توجد مبيعات مؤكدة بعد.
 * ترتيب تحريري شفاف (تقييم حقيقي ثم اكتمال البيانات) بلا ادعاء مبيعات.
 */
export const curatedPicks = (list: Product[], limit = 8) =>
  [...list]
    .sort(
      (a, b) =>
        ratingScore(b) - ratingScore(a) ||
        (b.reviews ?? 0) - (a.reviews ?? 0) ||
        (b.stock ?? 0) - (a.stock ?? 0)
    )
    .slice(0, limit);

export const newArrivals = (list: Product[], limit = 8) =>
  list.filter((p) => p.badge === "new" || p.badge === "limited").slice(0, limit);

export const onSale = (list: Product[]) => list.filter((p) => p.compareAt);

export const relatedProducts = (list: Product[], product: Product, limit = 4) =>
  list
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category === product.category || p.gender === product.gender)
    )
    .slice(0, limit);

export function sortProducts(list: Product[], key: SortKey = "featured") {
  const copy = [...list];
  switch (key) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "rating":
      return copy.sort(
        (a, b) =>
          ratingScore(b) - ratingScore(a) ||
          (b.reviews ?? 0) - (a.reviews ?? 0) ||
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0)
      );
    default:
      // «الأكثر رواجاً»: مبيعات حقيقية أولاً ثم التقييم المرجّح.
      return copy.sort(
        (a, b) =>
          (b.popularityScore ?? 0) - (a.popularityScore ?? 0) ||
          (b.salesCount ?? 0) - (a.salesCount ?? 0) ||
          ratingScore(b) - ratingScore(a)
      );
  }
}

/** بحث نصّي بسيط على الاسم والوصف والتصنيف. */
export function searchProducts(list: Product[], q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const words = term.split(/\s+/);
  return list.filter((p) => {
    const haystack = [p.name, p.subtitle, p.description, p.category, p.gender]
      .join(" ")
      .toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function priceBounds(list: Product[]) {
  if (!list.length) return { min: 0, max: 0 };
  const prices = list.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export const findCategory = (list: Category[], slug: string) =>
  list.find((c) => c.slug === slug);

export const categoriesByParent = (list: Category[], parent?: string) =>
  list.filter((c) => (parent ? c.parent === parent : true));

/* ── أنواع صفوف قاعدة البيانات ───────────────────────────── */

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  category: string;
  gender: Gender;
  /** PostgREST قد يُرجع numeric كرقم أو كنص — نتعامل مع الاثنين. */
  price: string | number;
  compare_at: string | number | null;
  rating: string | number;
  reviews: number;
  sales_count?: string | number | null;
  popularity_score?: string | number | null;
  badge: Badge | null;
  artwork: ArtworkKind;
  tone: string;
  options: Product["options"] | null;
  colors: Product["colors"] | null;
  notes: Product["notes"] | null;
  description: string;
  features: string[] | null;
  stock: number;
  active?: boolean;
  /** مسار الصورة الرئيسية داخل bucket `product-images`. */
  image_path?: string | null;
  /** jsonb: { "أحمر": ["products/...", ...] } — يُنظَّف قبل الاستخدام. */
  color_images?: unknown;
};

export type CategoryRow = {
  slug: string;
  name: string;
  name_en: string;
  parent: string | null;
  gender: Gender | null;
  blurb: string;
};

const MAX_COLOR_IMAGE_PATHS = 5;
const MAX_COLOR_KEY_LENGTH = 60;
const MAX_COLOR_KEYS = 24;

/**
 * ينظّف `color_images` القادم من jsonb: يتجاهل الأجسام/المصفوفات/النصوص
 * غير الصالحة، ويحذف المسارات الفارغة، ويحدّ كل مصفوفة بـ 5 مسارات،
 * ويحدّ طول المفتاح وعدد المفاتيح — محافظاً على اسم اللون كما هو (مطابقة تامة).
 */
function sanitizeColorImages(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim() || key.length > MAX_COLOR_KEY_LENGTH) continue;
    if (!Array.isArray(value)) continue;
    const paths: string[] = [];
    for (const entry of value) {
      if (typeof entry !== "string") continue;
      const path = entry.trim().replace(/^\/+/, "");
      if (!path) continue;
      paths.push(path);
      if (paths.length >= MAX_COLOR_IMAGE_PATHS) break;
    }
    if (paths.length) out[key] = paths;
    if (Object.keys(out).length >= MAX_COLOR_KEYS) break;
  }
  return Object.keys(out).length ? out : undefined;
}

/** يحوّل صف قاعدة البيانات إلى نوع `Product` المستخدم في الواجهة. */
export function rowToProduct(r: ProductRow): Product {
  const imagePath =
    typeof r.image_path === "string" && r.image_path.trim()
      ? r.image_path.trim().replace(/^\/+/, "")
      : undefined;

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    category: r.category,
    gender: r.gender,
    price: Number(r.price),
    compareAt: r.compare_at === null ? undefined : Number(r.compare_at),
    rating: Number(r.rating),
    reviews: r.reviews,
    salesCount: Number(r.sales_count ?? 0),
    popularityScore: Number(r.popularity_score ?? 0),
    badge: r.badge ?? undefined,
    artwork: r.artwork,
    tone: r.tone,
    options: r.options ?? undefined,
    colors: r.colors ?? undefined,
    notes: r.notes ?? undefined,
    description: r.description,
    features: r.features ?? [],
    stock: r.stock,
    active: r.active ?? true,
    imagePath,
    colorImages: sanitizeColorImages(r.color_images),
  };
}

export function rowToCategory(r: CategoryRow): Category {
  return {
    slug: r.slug,
    name: r.name,
    nameEn: r.name_en,
    parent: r.parent ?? undefined,
    gender: r.gender ?? undefined,
    blurb: r.blurb,
  };
}
