"use client";

import { useState } from "react";
import Link from "next/link";
import ProductArtwork from "./ProductArtwork";
import Rating from "./Rating";
import { useCart } from "./cart/CartProvider";
import { PlusIcon } from "./icons";
import { formatPrice, site } from "@/lib/site";
import { categoryBySlug } from "@/lib/categories";
import { productImageUrl } from "@/lib/media";
import type { Product } from "@/lib/types";

const badgeStyle: Record<string, { label: string; className: string }> = {
  new: { label: "جديد", className: "bg-ink text-white" },
  sale: { label: "خصم", className: "bg-maroon text-white" },
  limited: { label: "إصدار محدود", className: "bg-white text-maroon border border-maroon/20" },
};

/**
 * شارة «الأكثر مبيعاً» لا تُدار يدوياً: تُحسب من المبيعات المؤكدة في
 * الأقسام المخصّصة، وشارة المنتج تبقى للحالات التحريرية فقط (جديد/خصم/محدود).
 */

/** أول صورة لون مختلفة عن الصورة الرئيسية — تُستخدم في تأثير الـ hover. */
function pickHoverUrl(product: Product, mainUrl: string): string | null {
  const map = product.colorImages;
  if (!map || typeof map !== "object") return null;
  for (const paths of Object.values(map)) {
    if (!Array.isArray(paths)) continue;
    for (const path of paths) {
      if (typeof path !== "string") continue;
      const url = productImageUrl(path);
      if (url && url !== mainUrl) return url;
    }
  }
  return null;
}

export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const { add } = useCart();
  const category = categoryBySlug(product.category);
  const badge =
    product.badge && product.badge !== "best" ? badgeStyle[product.badge] : null;
  const discount = product.compareAt
    ? Math.round((1 - product.price / product.compareAt) * 100)
    : 0;
  const needsChoice = Boolean(product.options || product.colors);
  const choiceLabel = product.options ? "اختر المقاس" : "اختر اللون";

  const mainUrl = productImageUrl(product.imagePath);
  const [imageFailed, setImageFailed] = useState(false);
  const hoverUrl = mainUrl && !imageFailed ? pickHoverUrl(product, mainUrl) : null;

  function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add(product.id, {
      option: product.options?.values[0],
      color: product.colors?.[0]?.name,
    });
  }

  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/product/${product.slug}`}
        className="relative block overflow-hidden rounded-2xl border border-line-soft bg-white"
      >
        <div className="relative aspect-square overflow-hidden">
          {mainUrl && !imageFailed ? (
            <>
              <img
                src={mainUrl}
                alt={product.name}
                loading="lazy"
                decoding="async"
                onError={() => setImageFailed(true)}
                className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />
              {hoverUrl && (
                <img
                  src={hoverUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <>
              <ProductArtwork
                kind={product.artwork}
                tone={product.tone}
                className="size-full transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />
              <ProductArtwork
                kind={product.artwork}
                tone={product.tone}
                variant={2}
                className="absolute inset-0 size-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            </>
          )}
        </div>

        {badge && (
          <span
            className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        )}

        {discount > 0 && (
          <span className="num absolute top-3 left-3 rounded-full bg-white/90 px-2 py-1 text-[0.62rem] font-bold text-maroon backdrop-blur">
            −{discount}%
          </span>
        )}

        {/* Quick add / choose */}
        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
          {needsChoice ? (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white/95 py-2.5 text-[0.78rem] font-bold text-ink backdrop-blur">
              {choiceLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={quickAdd}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-ink/92 py-2.5 text-[0.78rem] font-bold text-white backdrop-blur transition-colors hover:bg-maroon"
            >
              <PlusIcon className="size-3.5" />
              أضف للسلة
            </button>
          )}
        </div>
      </Link>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <div className="flex items-center gap-1.5 text-[0.66rem] font-semibold tracking-wide text-ink-mute">
          <span>{category?.name}</span>
        </div>

        <h3 className="mt-1 text-[0.95rem] font-bold leading-snug text-ink">
          <Link href={`/product/${product.slug}`} className="hover:text-copper-dark">
            {product.name}
          </Link>
        </h3>

        <p className="mt-0.5 line-clamp-1 text-[0.74rem] text-ink-mute">{product.subtitle}</p>

        <div className="mt-1.5">
          <Rating value={product.rating} reviews={product.reviews} />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-[1.02rem] font-extrabold text-ink">
            {formatPrice(product.price)}
            <span className="ms-1 text-[0.65rem] font-semibold text-ink-mute">{site.currency}</span>
          </span>
          {product.compareAt && (
            <span className="num text-[0.78rem] text-ink-mute line-through">
              {formatPrice(product.compareAt)}
            </span>
          )}
        </div>

        {/* Mobile add button */}
        <div className="mt-2.5 md:hidden">
          {needsChoice ? (
            <Link
              href={`/product/${product.slug}`}
              className="block rounded-full border border-line py-2 text-center text-[0.75rem] font-bold text-ink"
            >
              {choiceLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => add(product.id)}
              className="w-full rounded-full bg-ink py-2 text-[0.75rem] font-bold text-white"
            >
              أضف للسلة
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
