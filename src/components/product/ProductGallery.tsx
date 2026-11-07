"use client";

import { useState } from "react";
import ProductArtwork from "@/components/ProductArtwork";
import { productImageUrl } from "@/lib/media";
import { site } from "@/lib/site";
import type { Product } from "@/lib/types";

const MAX_THUMBS = 9;

const frames = [
  { scale: "scale-100", variant: 1 as const },
  { scale: "scale-[1.35]", variant: 2 as const },
  { scale: "scale-[0.85]", variant: 1 as const },
];

/**
 * يبني قائمة الصور الحقيقية: الصورة الرئيسية أولاً، ثم صور اللون المختار،
 * أو كل صور الألوان حين لا يكون لون محدد — مع إزالة التكرار وتحديد العدد.
 */
function buildSlides(product: Product, selectedColor?: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (path?: string | null) => {
    const url = productImageUrl(path);
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  push(product.imagePath);

  const map = product.colorImages;
  if (map && typeof map === "object" && !Array.isArray(map)) {
    if (selectedColor) {
      const chosen = map[selectedColor];
      if (Array.isArray(chosen)) {
        for (const path of chosen) if (typeof path === "string") push(path);
      }
    } else {
      for (const paths of Object.values(map)) {
        if (!Array.isArray(paths)) continue;
        for (const path of paths) if (typeof path === "string") push(path);
      }
    }
  }

  return urls.slice(0, MAX_THUMBS);
}

/** ألوان لها صور فعلية — تُعرض كمُحدِّد داخل المعرض. */
function colorSwatches(product: Product) {
  const namesWithImages = new Set(
    Object.entries(product.colorImages ?? {})
      .filter(([, paths]) => Array.isArray(paths) && paths.length > 0)
      .map(([name]) => name)
  );
  return (product.colors ?? []).filter((c) => namesWithImages.has(c.name));
}

export default function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

  const slides = buildSlides(product, selectedColor);
  const swatches = colorSwatches(product);

  /* لا صور حقيقية → نُبقي على الرسوم المتجهية المولّدة كما هي تماماً. */
  if (slides.length === 0) {
    const frame = frames[Math.min(active, frames.length - 1)];
    return (
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {/* thumbs */}
        <div className="flex gap-2 sm:flex-col">
          {frames.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              className={`size-16 shrink-0 overflow-hidden rounded-xl border bg-white transition-all sm:size-20 ${
                active === i
                  ? "border-copper ring-2 ring-copper/20"
                  : "border-line-soft hover:border-copper/50"
              }`}
            >
              <ProductArtwork
                kind={product.artwork}
                tone={product.tone}
                variant={f.variant}
                className="size-full"
                strokeScale={1.8}
              />
            </button>
          ))}
        </div>

        {/* main */}
        <div className="relative flex-1 overflow-hidden rounded-3xl border border-line-soft bg-white">
          <div className="aspect-square">
            <ProductArtwork
              key={active}
              kind={product.artwork}
              tone={product.tone}
              variant={frame.variant}
              className={`size-full origin-center transition-transform duration-700 ${frame.scale}`}
            />
          </div>

          {product.badge === "sale" && product.compareAt && (
            <span className="num absolute top-4 right-4 rounded-full bg-maroon px-3 py-1 text-[0.68rem] font-bold text-white">
              وفّر {product.compareAt - product.price} {site.currency}
            </span>
          )}
        </div>
      </div>
    );
  }

  const safeActive = Math.min(active, slides.length - 1);
  const mainUrl = slides[safeActive];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {/* thumbs */}
        <div className="flex gap-2 sm:flex-col">
          {slides.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setActive(i);
                setZoomed(false);
              }}
              aria-label={`صورة ${i + 1}`}
              aria-current={safeActive === i ? "true" : undefined}
              className={`size-16 shrink-0 overflow-hidden rounded-xl border bg-white transition-all sm:size-20 ${
                safeActive === i
                  ? "border-copper ring-2 ring-copper/20"
                  : "border-line-soft hover:border-copper/50"
              }`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* main */}
        <div className="relative flex-1 overflow-hidden rounded-3xl border border-line-soft bg-white">
          <div className="aspect-square overflow-hidden">
            <img
              key={mainUrl}
              src={mainUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onClick={() => setZoomed((z) => !z)}
              className={`size-full object-cover transition-transform duration-500 ease-out ${
                zoomed ? "scale-[1.6] cursor-zoom-out" : "scale-100 cursor-zoom-in"
              }`}
            />
          </div>

          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? "تصغير الصورة" : "تكبير الصورة"}
            aria-pressed={zoomed}
            className="absolute left-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
              <line x1="8" y1="11" x2="14" y2="11" />
              {!zoomed && <line x1="11" y1="8" x2="11" y2="14" />}
            </svg>
          </button>

          {product.badge === "sale" && product.compareAt && (
            <span className="num absolute top-4 right-4 rounded-full bg-maroon px-3 py-1 text-[0.68rem] font-bold text-white">
              وفّر {product.compareAt - product.price} {site.currency}
            </span>
          )}
        </div>
      </div>

      {/* colour filter — يرتّب/يصفّي الصور حسب اللون المختار */}
      {swatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedColor(undefined);
              setActive(0);
            }}
            aria-pressed={selectedColor === undefined}
            className={`rounded-full border px-3 py-1 text-[0.72rem] font-semibold transition-colors ${
              selectedColor === undefined
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink-soft hover:border-copper"
            }`}
          >
            الكل
          </button>
          {swatches.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setSelectedColor(c.name);
                setActive(0);
              }}
              aria-label={c.name}
              aria-pressed={selectedColor === c.name}
              title={c.name}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
                selectedColor === c.name
                  ? "border-copper bg-copper/10 text-ink"
                  : "border-line bg-white text-ink-soft hover:border-copper"
              }`}
            >
              <span
                className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ background: c.hex }}
              />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
