export const site = {
  // ── ثوابت تقنية فقط (مصدر احتياطي للثوابت غير المتعلقة بالهوية) ──
  url: "https://stoor.example",
  /** العملة الرسمية: الريال اليمني */
  currency: "ر.ي",
  country: "YE",
  locale: "ar-YE",
  /** مهلة مراجعة إيصال التحويل قبل الإلغاء التلقائي (أيام) */
  transferHoldDays: 3,

  // ── قيم هوية قديمة (legacy fallback) ───────────────────────
  // هوية المتجر تُقرأ الآن من getStoreInfo() في src/lib/store-info.ts
  // (الاسم، العنوان، التواصل، الشبكات، الشعار...). تُبقى هذه القيم فقط
  // كاحتياط للملفات التي لم تُحوَّل بعد، ولا تستخدمها مكوّنات الواجهة
  // المحدّثة. لا تُضف هنا أي حقول شحن/توصيل أو رسوم دفع عند الاستلام.
  name: "ستور",
  nameEn: "STOOR",
  tagline: "عطور وإكسسوارات وحقائب — رجالي ونسائي وأطفال",
  description:
    "متجر ستور للعطور والإكسسوارات والحقائب. عطور شرقية وفرنسية، سلاسل وأقراط وخواتم وساعات وحقائب، بجودة عالية واختيار بعناية.",
  whatsapp: "967770000000",
  phone: "+967 77 000 0000",
  email: "hello@stoor.example",
  address: "صنعاء، اليمن",
  social: {
    instagram: "https://instagram.com",
    tiktok: "https://tiktok.com",
    snapchat: "https://snapchat.com",
    x: "https://x.com",
  },
} as const;

export const navLinks = [
  { href: "/category/men-perfumes", label: "عطور رجالية" },
  { href: "/category/women-perfumes", label: "عطور نسائية" },
  { href: "/category/unisex-perfumes", label: "عطور مشتركة" },
  { href: "/category/sets", label: "أطقم" },
  { href: "/category/necklaces", label: "سلاسل" },
  { href: "/category/earrings", label: "أقراط" },
  { href: "/category/watches", label: "ساعات" },
] as const;

/**
 * أرقام لاتينية موحّدة (٣٤٠ → 340).
 * الأرقام الغربية أسهل في القراءة على الشاشات الصغيرة، والأهم أنها تطابق
 * الأرقام المكتوبة داخل النصوص وأرقام الطلبات وبيانات JSON-LD.
 */
export const formatPrice = (value: number) =>
  new Intl.NumberFormat("ar-YE-u-nu-latn", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const priceLabel = (value: number) => `${formatPrice(value)} ${site.currency}`;
