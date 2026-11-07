"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StarIcon } from "@/components/icons";
import type { PublicReview, ReviewEligibility } from "@/lib/reviews";

/**
 * قسم تقييمات المنتج في المتجر.
 *
 * يقرأ التقييمات المعتمدة من الخادم عند الفتح (لا كاش) حتى يظهر اعتماد
 * المدير فوراً. لا يعرض أي تقييم غير معتمد، ولا يسمح بالإرسال إلا لمن
 * يملك طلباً مؤكداً/مكتملاً يحتوي المنتج.
 */

type Payload = {
  reviews: PublicReview[];
  summary: { rating: number; count: number };
  eligibility: ReviewEligibility;
};

const dateFormatter = new Intl.DateTimeFormat("ar-YE-u-ca-gregory-nu-latn", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(value: string): string {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return dateFormatter.format(parsed);
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-copper ${className}`} dir="ltr">
      {[0, 1, 2, 3, 4].map((i) => (
        <StarIcon
          key={i}
          className={`size-3.5 ${i < Math.round(value) ? "opacity-100" : "opacity-20"}`}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="rounded-2xl border border-line-soft bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.82rem] font-bold text-ink">
            {review.customerName}
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[0.6rem] font-bold text-success">
              مشترٍ موثّق
            </span>
          </p>
          <p className="mt-0.5 text-[0.68rem] text-ink-mute">{formatDate(review.createdAt)}</p>
        </div>
        <Stars value={review.rating} />
      </header>

      {review.comment && (
        <p className="mt-3 text-[0.84rem] leading-7 text-ink-soft">{review.comment}</p>
      )}

      {review.managerReply && (
        <div className="mt-3 rounded-xl bg-cream p-3">
          <p className="text-[0.68rem] font-bold text-copper-dark">رد المتجر</p>
          <p className="mt-1 text-[0.8rem] leading-6 text-ink-soft">{review.managerReply}</p>
        </div>
      )}
    </article>
  );
}

export default function ProductReviews({
  productId,
  productSlug,
  initialRating,
  initialCount,
}: {
  productId: string;
  productSlug: string;
  initialRating: number;
  initialCount: number;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((payload: { ok?: boolean } & Partial<Payload>) => {
        if (!alive || !payload?.ok || !payload.reviews || !payload.summary) return;
        setData({
          reviews: payload.reviews,
          summary: payload.summary,
          eligibility:
            payload.eligibility ?? ({ canReview: false, reason: "login" } as const),
        });
      })
      .catch(() => {
        /* نُبقي الملخّص من الخادم إن فشل التحميل */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [productId]);

  const summary = data?.summary ?? { rating: initialRating, count: initialCount };
  const reviews = data?.reviews ?? [];
  const eligibility = data?.eligibility ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setNotice(null);

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; message?: string };

      if (!res.ok || !payload.ok) {
        setNotice({ tone: "error", text: payload.error || "تعذّر إرسال التقييم" });
        return;
      }

      setComment("");
      setNotice({
        tone: "success",
        text: payload.message || "تم إرسال تقييمك — سيظهر بعد اعتماد المدير",
      });
      setData((current) =>
        current
          ? {
              ...current,
              eligibility: {
                canReview: false,
                reason: "already-reviewed",
                existingStatus: "pending",
              },
            }
          : current
      );
    } catch {
      setNotice({ tone: "error", text: "تعذّر الاتصال بالخادم — حاول مرة أخرى" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container-x py-12" id="reviews">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-bold tracking-wide text-copper-dark">آراء العملاء</p>
          <h2 className="mt-1 text-xl font-extrabold text-ink">تقييمات المنتج</h2>
        </div>
        <p className="text-[0.74rem] text-ink-mute">
          تُعرض التقييمات بعد مراجعة المتجر — من مشترين موثّقين فقط.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="h-fit rounded-2xl border border-line-soft bg-white p-6">
          <p className="num text-4xl font-extrabold text-ink">
            {summary.count > 0 ? summary.rating.toFixed(1) : "—"}
          </p>
          <Stars value={summary.rating} className="mt-1" />
          <p className="mt-2 text-[0.76rem] text-ink-mute">
            {summary.count > 0
              ? `من ${summary.count} تقييماً معتمداً`
              : "لا توجد تقييمات معتمدة بعد"}
          </p>

          <div className="mt-5 border-t border-line-soft pt-4">
            {eligibility?.canReview ? (
              <p className="text-[0.76rem] leading-6 text-ink-soft">
                يمكنك تقييم هذا المنتج لأنك اشتريته في طلب مؤكد.
              </p>
            ) : eligibility?.reason === "login" ? (
              <p className="text-[0.76rem] leading-6 text-ink-soft">
                سجّل دخولك لتقييم المنتج إن كنت قد اشتريته.
                <Link
                  href={`/account?next=${encodeURIComponent(`/product/${productSlug}`)}`}
                  className="mt-2 block font-bold text-copper-dark underline-offset-4 hover:underline"
                >
                  تسجيل الدخول
                </Link>
              </p>
            ) : eligibility?.reason === "already-reviewed" ? (
              <p className="text-[0.76rem] leading-6 text-ink-soft">
                {eligibility.existingStatus === "approved"
                  ? "تقييمك منشور — شكراً لك."
                  : eligibility.existingStatus === "rejected"
                    ? "لم يُعتمد تقييمك السابق لهذا المنتج."
                    : "استلمنا تقييمك وهو بانتظار اعتماد المتجر."}
              </p>
            ) : eligibility?.reason === "not-bought" ? (
              <p className="text-[0.76rem] leading-6 text-ink-soft">
                التقييم متاح لمن اشترى المنتج في طلب مؤكد أو مكتمل.
              </p>
            ) : (
              <p className="text-[0.76rem] text-ink-mute">جارٍ التحقق من حالة الشراء…</p>
            )}
          </div>
        </aside>

        <div className="space-y-4">
          {eligibility?.canReview && (
            <form
              onSubmit={submit}
              className="rounded-2xl border border-line-soft bg-white p-5"
            >
              <h3 className="text-[0.9rem] font-extrabold text-ink">أضف تقييمك</h3>
              <p className="mt-1 text-[0.72rem] text-ink-mute">
                تقييم واحد لكل منتج — يظهر بعد اعتماد المتجر.
              </p>

              <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= (hover || rating);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHover(value)}
                      aria-label={`${value} من 5`}
                      aria-pressed={rating === value}
                      className={`rounded p-0.5 transition-transform hover:scale-110 ${
                        active ? "text-copper" : "text-line"
                      }`}
                    >
                      <StarIcon className="size-7" />
                    </button>
                  );
                })}
                <span className="num ms-2 text-[0.78rem] font-bold text-ink-soft">
                  {rating} / 5
                </span>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[0.74rem] font-bold text-ink">
                  تعليقك (اختياري)
                </span>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={800}
                  rows={3}
                  placeholder="كيف كانت تجربتك مع المنتج؟"
                  className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-[0.82rem] text-ink outline-none focus:border-copper"
                />
              </label>

              {notice && (
                <p
                  className={`mt-2 text-[0.76rem] font-semibold ${
                    notice.tone === "success" ? "text-success" : "text-danger"
                  }`}
                  role="status"
                >
                  {notice.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary mt-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "جارٍ الإرسال…" : "إرسال التقييم"}
              </button>
            </form>
          )}

          {loading && !data ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-[0.8rem] text-ink-mute">
              جارٍ تحميل التقييمات…
            </p>
          ) : reviews.length > 0 ? (
            reviews.map((review) => <ReviewCard key={review.id} review={review} />)
          ) : (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-[0.8rem] text-ink-mute">
              لا توجد تقييمات معتمدة بعد — كن أول من يقيّم المنتج.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
