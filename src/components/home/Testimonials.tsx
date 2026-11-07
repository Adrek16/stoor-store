"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import { StarIcon } from "@/components/icons";
import type { HomeReview } from "@/lib/reviews";

/**
 * «آراء العملاء» في الرئيسية — تقييمات معتمدة من مشترين موثّقين فقط.
 *
 * تُجلب من `/api/reviews` عند الفتح (بلا كاش) كي يظهر اعتماد المدير فوراً.
 * لا نعرض أي محتوى تجريبي: إن لم توجد تقييمات معتمدة يختفي القسم بالكامل.
 */

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

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-copper" dir="ltr">
      {[0, 1, 2, 3, 4].map((i) => (
        <StarIcon
          key={i}
          className={`size-3.5 ${i < Math.round(value) ? "opacity-100" : "opacity-20"}`}
        />
      ))}
    </span>
  );
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<HomeReview[]>([]);

  useEffect(() => {
    let alive = true;

    fetch("/api/reviews?limit=6", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: { ok?: boolean; reviews?: HomeReview[] }) => {
        if (!alive || !payload?.ok || !Array.isArray(payload.reviews)) return;
        setReviews(payload.reviews);
      })
      .catch(() => {
        /* القسم اختياري — نبقيه مخفياً عند فشل التحميل */
      });

    return () => {
      alive = false;
    };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="border-y border-line bg-white">
      <div className="container-x py-14">
        <SectionHeader
          eyebrow="آراء العملاء"
          title="قالوا عن ستور"
          description="تقييمات معتمدة من مشترين موثّقين فقط — بلا محتوى تجريبي."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <figure
              key={review.id}
              className="flex h-full flex-col rounded-2xl border border-line-soft bg-cream/60 p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <Stars value={review.rating} />
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[0.6rem] font-bold text-success">
                  شراء موثّق
                </span>
              </div>

              {review.comment && (
                <blockquote className="flex-1 text-[0.88rem] leading-7 text-ink-soft">
                  “{review.comment}”
                </blockquote>
              )}

              {review.managerReply && (
                <p className="mt-3 rounded-xl bg-white p-3 text-[0.76rem] leading-6 text-ink-soft">
                  <span className="font-bold text-copper-dark">رد المتجر: </span>
                  {review.managerReply}
                </p>
              )}

              <figcaption className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4">
                <span className="grid size-9 place-items-center rounded-full bg-copper/15 text-[0.68rem] font-bold text-copper-dark">
                  {review.customerName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8rem] font-bold text-ink">
                    {review.customerName}
                  </p>
                  <p className="text-[0.68rem] text-ink-mute">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
              </figcaption>

              <Link
                href={`/product/${review.productSlug}`}
                className="mt-3 truncate text-[0.72rem] font-bold text-copper-dark underline-offset-4 hover:underline"
              >
                {review.productName}
              </Link>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
