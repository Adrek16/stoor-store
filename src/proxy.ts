import { NextResponse, type NextRequest } from "next/server";
import { renamedCategorySlug } from "@/lib/category-redirects";
import { renamedProductSlug } from "@/lib/product-redirects";

/**
 * تحويل روابط التصنيفات والمنتجات القديمة قبل الوصول إلى الصفحة.
 *
 * لماذا Proxy وليس داخل الصفحة؟
 *  - الصفحة تُبنى مسبقاً (PPR)، وقراءة قاعدة البيانات داخلها تُفشل البناء
 *    أو تُرجع صفحة خطأ للروابط غير المعروفة.
 *  - Proxy يعمل في Node.js قبل التصيير، فيصدر تحويلاً دائماً حقيقياً (308)
 *    دون تحميل الصفحة أصلاً.
 *
 * لا يمسّ هذا الملف الروابط الحيّة: سجلا `category_slug_history` و
 * `product_slug_history` يُحذف منهما الرابط عند إعادة استخدامه.
 */

const CATEGORY_PATH = /^\/category\/([^/]+)\/?$/;
const PRODUCT_PATH = /^\/product\/([^/]+)\/?$/;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const categoryMatch = pathname.match(CATEGORY_PATH);
  const productMatch = categoryMatch ? null : pathname.match(PRODUCT_PATH);
  const match = categoryMatch ?? productMatch;

  if (!match) return NextResponse.next();

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return NextResponse.next();
  }

  const renamed = categoryMatch
    ? await renamedCategorySlug(slug)
    : await renamedProductSlug(slug);

  if (!renamed) return NextResponse.next();

  const base = categoryMatch ? "/category" : "/product";
  const target = new URL(
    `${base}/${encodeURIComponent(renamed)}${request.nextUrl.search}`,
    request.url
  );
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/category/:path*", "/product/:path*"],
};
