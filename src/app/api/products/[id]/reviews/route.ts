import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer";
import { rateLimit } from "@/lib/rate-limit";
import { sbSelect } from "@/lib/supabase";
import {
  createReview,
  getApprovedReviews,
  getReviewEligibility,
} from "@/lib/reviews";

/**
 * تقييمات منتج واحد.
 *
 *  GET  → التقييمات المعتمدة + ملخّص التقييم + هل يحق للزائر التقييم.
 *  POST → إرسال تقييم (يتطلب جلسة عميل وشراء مؤكد)، ويبقى بانتظار المدير.
 *
 * لا يُرجع أي بريد أو معرّف حساب — أسماء العرض مختصرة في طبقة `lib/reviews`.
 */

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

const noStore = { "Cache-Control": "no-store" };

async function readProduct(productId: string) {
  const rows = await sbSelect<{
    id: string;
    slug: string;
    active: boolean;
    rating: string | number;
    reviews: number;
  }>(
    "products",
    `select=id,slug,active,rating,reviews&id=eq.${encodeURIComponent(productId)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = decodeURIComponent(id);

  try {
    const product = await readProduct(productId);
    if (!product || product.active === false) {
      return NextResponse.json(
        { ok: false, error: "المنتج غير موجود" },
        { status: 404, headers: noStore }
      );
    }

    const customer = customerFromRequest(request);

    const [reviews, eligibility] = await Promise.all([
      getApprovedReviews(productId),
      customer
        ? getReviewEligibility(customer.uid, {
            id: String(product.id),
            slug: String(product.slug),
          })
        : Promise.resolve({ canReview: false, reason: "login" } as const),
    ]);

    return NextResponse.json(
      {
        ok: true,
        reviews,
        summary: {
          rating: Number(product.rating) || 0,
          count: Number(product.reviews) || 0,
        },
        eligibility,
      },
      { headers: noStore }
    );
  } catch (error) {
    console.error("[product-reviews] read failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحميل التقييمات" },
      { status: 500, headers: noStore }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = decodeURIComponent(id);

  const customer = customerFromRequest(request);
  if (!customer) {
    return NextResponse.json(
      { ok: false, error: "سجّل دخولك أولاً لتقييم المنتج" },
      { status: 401, headers: noStore }
    );
  }

  // ٥ محاولات تقييم في الساعة لكل حساب — حماية من الإغراق.
  const limit = rateLimit(`review:${customer.uid}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "محاولات كثيرة — حاول بعد قليل" },
      {
        status: 429,
        headers: { ...noStore, "Retry-After": String(limit.retryAfter) },
      }
    );
  }

  let body: { rating?: unknown; comment?: unknown };
  try {
    body = (await request.json()) as { rating?: unknown; comment?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "صيغة الطلب غير صحيحة" },
      { status: 400, headers: noStore }
    );
  }

  const result = await createReview({
    productId,
    customerId: customer.uid,
    rating: body.rating,
    comment: body.comment,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: noStore }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "تم إرسال تقييمك — سيظهر بعد اعتماد المدير",
    },
    { status: 201, headers: noStore }
  );
}
