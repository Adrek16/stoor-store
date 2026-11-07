import { hasSupabase, isMissingTable, sb } from "./supabase";

type SlugHistoryRow = { new_slug: string };

/**
 * روابط التصنيفات القديمة.
 *
 * عند تغيير رابط تصنيف من لوحة المدير يُسجَّل الانتقال في
 * `category_slug_history`. نستخدمه لتحويل الرابط القديم تحويلاً دائماً
 * بدل إرجاع 404، فلا تنكسر الروابط المنشورة أو المفهرسة في محركات البحث.
 *
 * القراءة غير مخزَّنة: التغيير يظهر فوراً بعد حفظه في اللوحة.
 */
export async function renamedCategorySlug(slug: string): Promise<string | null> {
  if (!hasSupabase || !slug) return null;

  try {
    const rows = await sb<SlugHistoryRow[]>(
      `category_slug_history?select=new_slug&old_slug=eq.${encodeURIComponent(slug)}&limit=1`,
      // Proxy يقع على مسار كل صفحة تصنيف: مهلة قصيرة وفشل آمن خير من تعليق التنقّل.
      { timeoutMs: 2500, attempts: 1 }
    );

    const next = rows[0]?.new_slug;
    return typeof next === "string" && next && next !== slug ? next : null;
  } catch (error) {
    if (!isMissingTable(error)) {
      console.warn(
        "[category-redirects] تعذّرت قراءة سجل الروابط:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}
