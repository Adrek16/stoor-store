import { hasSupabase, isMissingTable, sbSelect } from "./supabase";

type SlugHistoryRow = { new_slug: string };

/**
 * روابط المنتجات القديمة.
 *
 * المنتج يأخذ رابطاً رقمياً مشتقاً من تصنيفه، وعند نقله إلى تصنيف آخر
 * يُصرف له رابط جديد ويُسجَّل القديم في `product_slug_history`.
 * نحوّل القديم تحويلاً دائماً بدل إرجاع 404، فلا تنكسر الروابط المنشورة.
 *
 * القراءة غير مخزَّنة: التغيير يظهر فوراً بعد حفظه في لوحة المدير.
 */
export async function renamedProductSlug(slug: string): Promise<string | null> {
  if (!hasSupabase || !slug) return null;

  try {
    const rows = await sbSelect<SlugHistoryRow>(
      "product_slug_history",
      `select=new_slug&old_slug=eq.${encodeURIComponent(slug)}&limit=1`
    );

    const next = rows[0]?.new_slug;
    return typeof next === "string" && next && next !== slug ? next : null;
  } catch (error) {
    if (!isMissingTable(error)) {
      console.warn(
        "[product-redirects] تعذّرت قراءة سجل الروابط:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}
