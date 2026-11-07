import { cacheLife, cacheTag } from "next/cache";
import { hasSupabase, isMissingTable, sbSelect } from "./supabase";

/**
 * مصدر هوية المتجر الوحيد للخادم.
 *
 * يقرأ صف `key='store_info'` من جدول `settings` (قيمة JSONB) بمفتاح
 * `service_role` فقط، لأن الجدول عليه RLS بلا سياسات عامة. عند غياب
 * مفاتيح Supabase أو عدم وجود الجدول أو فشل القراءة نرجع للقيم
 * الافتراضية المطابقة لبذرة migration 008 — فيظل المتجر يعمل.
 *
 * ⚠️ هذا الملف للخادم فقط. لا تستورده في مكوّنات `'use client'`؛
 * مرّر البيانات كـ props بدلاً من ذلك (يُسمح بـ `import type`).
 * القراءة مُخزَّنة بالوسم `store_info` وتُبطلها لوحة المدير عبر
 * `/api/revalidate` بعد كل حفظ.
 */

export type StoreSocial = {
  instagram: string;
  tiktok: string;
  snapchat: string;
  x: string;
};

export type StoreInfo = {
  name: string;
  nameEn: string;
  tagline: string;
  description: string;
  about: string;
  welcomeLine1: string;
  welcomeLine2: string;
  welcomeBody: string;
  workingHours: string;
  address: string;
  mapUrl: string;
  whatsapp: string;
  phone: string;
  email: string;
  social: StoreSocial;
  logoPath: string;
};

export const STORE_INFO_TAG = "store_info";

/** قيم افتراضية مطابقة حرفياً لبذرة 008_store_info_product_images_no_shipping.sql. */
export const DEFAULT_STORE_INFO: StoreInfo = {
  name: "ستور",
  nameEn: "STOOR",
  tagline: "عطور وإكسسوارات وحقائب — رجالي ونسائي وأطفال",
  description:
    "متجر ستور للعطور والإكسسوارات والحقائب. عطور شرقية وفرنسية، سلاسل وأقراط وخواتم وساعات وحقائب، بجودة عالية واختيار بعناية.",
  about:
    "عطور شرقية وفرنسية وإكسسوارات مختارة بعناية — للرجال والنساء. جودة نتحمّل مسؤوليتها.",
  welcomeLine1: "بريقٌ يبقى،",
  welcomeLine2: "ورائحةٌ تُذكر.",
  welcomeBody:
    "قطع مختارة بعناية من العطور الشرقية والفرنسية، والإكسسوارات المعدنية، والحقائب الأنيقة — للرجال والنساء والأطفال. جودة نتحمّل مسؤوليتها.",
  workingHours: "من 9 صباحاً إلى 9 مساءً، طوال أيام الأسبوع",
  address: "صنعاء، اليمن",
  mapUrl: "",
  whatsapp: "967770000000",
  phone: "+967 77 000 0000",
  email: "hello@stoor.example",
  social: { instagram: "", tiktok: "", snapchat: "", x: "" },
  logoPath: "",
};

type StoreInfoRow = Partial<Omit<StoreInfo, "social">> & {
  social?: Partial<StoreSocial> | null;
};

/**
 * دمج قيمة قاعدة البيانات فوق القيم الافتراضية: أي حقل ناقص أو بنوع خاطئ
 * يأخذ قيمته الافتراضية، فلا يظهر `undefined` أبداً حتى مع JSON ناقص.
 * السلاسل الفارغة تُحترم (قد يفرّغها المدير قصداً).
 */
export function cleanStoreInfo(input: StoreInfoRow | null | undefined): StoreInfo {
  const d = DEFAULT_STORE_INFO;
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" ? v.trim() : fallback;
  const raw = input?.social;
  const s: Partial<StoreSocial> = raw && typeof raw === "object" ? raw : {};

  return {
    name: str(input?.name, d.name),
    nameEn: str(input?.nameEn, d.nameEn),
    tagline: str(input?.tagline, d.tagline),
    description: str(input?.description, d.description),
    about: str(input?.about, d.about),
    welcomeLine1: str(input?.welcomeLine1, d.welcomeLine1),
    welcomeLine2: str(input?.welcomeLine2, d.welcomeLine2),
    welcomeBody: str(input?.welcomeBody, d.welcomeBody),
    workingHours: str(input?.workingHours, d.workingHours),
    address: str(input?.address, d.address),
    mapUrl: str(input?.mapUrl, d.mapUrl),
    whatsapp: str(input?.whatsapp, d.whatsapp),
    phone: str(input?.phone, d.phone),
    email: str(input?.email, d.email),
    logoPath: str(input?.logoPath, d.logoPath),
    social: {
      instagram: str(s.instagram, d.social.instagram),
      tiktok: str(s.tiktok, d.social.tiktok),
      snapchat: str(s.snapchat, d.social.snapchat),
      x: str(s.x, d.social.x),
    },
  };
}

/** هوية المتجر المخزَّنة التي تقرأها كل صفحات الواجهة. */
export async function getStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheTag(STORE_INFO_TAG);
  cacheLife("minutes");

  if (!hasSupabase) return DEFAULT_STORE_INFO;

  try {
    const rows = await sbSelect<{ value: StoreInfoRow | null }>(
      "settings",
      "select=value&key=eq.store_info&limit=1"
    );
    return cleanStoreInfo(rows[0]?.value);
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn(
        "[store-info] جدول settings غير موجود بعد — استخدام القيم الافتراضية."
      );
    } else {
      console.error(
        "[store-info] تعذّرت القراءة من Supabase — استخدام القيم الافتراضية:",
        err instanceof Error ? err.message : err
      );
    }
    return DEFAULT_STORE_INFO;
  }
}
