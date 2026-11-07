import { NextResponse } from "next/server";
import { getLatestApprovedReviews } from "@/lib/reviews";

/**
 * أحدث التقييمات المعتمدة عبر كل المنتجات — لقسم الرئيسية.
 *
 * عام بلا جلسة، ولا يُرجع بريداً ولا معرّف حساب. يُقرأ من الخادم
 * مباشرة (بلا كاش) كي يظهر اعتماد المدير فوراً دون إعادة بناء الصفحة.
 */

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 6;

  try {
    const reviews = await getLatestApprovedReviews(limit);
    return NextResponse.json({ ok: true, reviews }, { headers: noStore });
  } catch (error) {
    console.error("[reviews] latest read failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحميل التقييمات" },
      { status: 500, headers: noStore }
    );
  }
}
