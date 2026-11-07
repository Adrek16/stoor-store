export type Gender = "men" | "women" | "unisex" | "kids";

export type ArtworkKind =
  | "perfume"
  | "necklace"
  | "earrings"
  | "bracelet"
  | "ring"
  | "set"
  | "watch"
  | "cufflinks"
  | "bag";

export type Badge = "new" | "best" | "sale" | "limited";

/** مسارات صور Supabase Storage لكل لون: اسم اللون (مطابق تماماً) → حتى 5 مسارات. */
export type ColorImages = Record<string, string[]>;

export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  category: string;
  gender: Gender;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  /** الوحدات المباعة من الطلبات المؤكدة/المكتملة — تُحسب في القاعدة. */
  salesCount?: number;
  /** درجة الرواج = المبيعات + التقييم المرجّح — تُحسب في القاعدة. */
  popularityScore?: number;
  badge?: Badge;
  artwork: ArtworkKind;
  tone: string;
  /** Perfume volumes in ml, or accessory sizes */
  options?: { label: string; values: string[] };
  /** لون المنتج — stock اختياري: مخزون هذا اللون تحديداً */
  colors?: { name: string; hex: string; stock?: number }[];
  /** المسار الرئيسي لصورة المنتج داخل bucket `product-images`. */
  imagePath?: string | null;
  /** صور إضافية لكل لون — المفتاح يطابق `colors[].name` تماماً. */
  colorImages?: ColorImages;
  /** Perfume note pyramid */
  notes?: { top: string[]; heart: string[]; base: string[] };
  description: string;
  features: string[];
  stock: number;
  /** ظاهر للعملاء — يُستخدم في لوحة التحكم فقط. */
  active?: boolean;
};

export type Category = {
  slug: string;
  name: string;
  nameEn: string;
  parent?: string;
  gender?: Gender;
  blurb: string;
};

/**
 * الحد الأدنى من بيانات المنتج التي تحتاجها السلة داخل المتصفح.
 * يُمرَّر من الخادم إلى `CartProvider` بدل تحميل الكتالوج كاملاً في الحزمة.
 */
export type CartProduct = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "subtitle"
  | "price"
  | "compareAt"
  | "artwork"
  | "tone"
  | "options"
  | "colors"
  | "stock"
>;
