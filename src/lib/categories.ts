import type { Category } from "./types";

export const categories: Category[] = [
  {
    slug: "men-perfumes",
    name: "عطور رجالية",
    nameEn: "Men's Perfumes",
    parent: "perfumes",
    gender: "men",
    blurb: "عود، عنبر، وخشب — حضور يبقى في الذاكرة",
  },
  {
    slug: "women-perfumes",
    name: "عطور نسائية",
    nameEn: "Women's Perfumes",
    parent: "perfumes",
    gender: "women",
    blurb: "ورد، ياسمين، وفانيلا — نعومة تُروى",
  },
  {
    slug: "unisex-perfumes",
    name: "عطور مشتركة",
    nameEn: "Unisex Perfumes",
    parent: "perfumes",
    gender: "unisex",
    blurb: "تركيبات محايدة تناسب الاثنين",
  },
  {
    slug: "necklaces",
    name: "سلاسل",
    nameEn: "Necklaces",
    parent: "accessories",
    gender: "women",
    blurb: "طبقات ذهبية ناعمة تزيّن كل إطلالة",
  },
  {
    slug: "earrings",
    name: "أقراط",
    nameEn: "Earrings",
    parent: "accessories",
    gender: "women",
    blurb: "من الحلقة الصغيرة إلى القطعة اللافتة",
  },
  {
    slug: "bracelets",
    name: "أساور",
    nameEn: "Bracelets",
    parent: "accessories",
    gender: "women",
    blurb: "تفاصيل رقيقة على المعصم",
  },
  {
    slug: "rings",
    name: "خواتم",
    nameEn: "Rings",
    parent: "accessories",
    gender: "women",
    blurb: "قطعة واحدة تكفي لتغيّر اليد",
  },
  {
    slug: "sets",
    name: "أطقم",
    nameEn: "Sets",
    parent: "accessories",
    gender: "women",
    blurb: "تناسق كامل في علبة واحدة",
  },
  {
    slug: "watches",
    name: "ساعات",
    nameEn: "Watches",
    parent: "accessories",
    gender: "men",
    blurb: "دقة التصميم قبل دقة الوقت",
  },
  {
    slug: "leather-bracelets",
    name: "أساور جلدية",
    nameEn: "Leather Bracelets",
    parent: "accessories",
    gender: "men",
    blurb: "جلد طبيعي بلمسة معدنية",
  },
  {
    slug: "men-necklaces",
    name: "سلاسل رجالية",
    nameEn: "Men's Necklaces",
    parent: "accessories",
    gender: "men",
    blurb: "فضة مصقولة بخطوط حادة",
  },
  {
    slug: "cufflinks",
    name: "أزرار أكمام",
    nameEn: "Cufflinks",
    parent: "accessories",
    gender: "men",
    blurb: "التفصيلة الصغيرة في الإطلالة الرسمية",
  },
  {
    slug: "bags",
    name: "حقائب",
    nameEn: "Bags",
    parent: "bags",
    gender: "unisex",
    blurb: "حقائب أنيقة لكل يوم ومناسبة",
  },
];

export const categoryBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug);

export const genderLabel: Record<string, string> = {
  men: "رجالي",
  women: "نسائي",
  unisex: "للجنسين",
  kids: "أطفال",
};
