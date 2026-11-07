"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { MinusIcon, PlusIcon, ReturnIcon, StoreIcon } from "@/components/icons";
import Rating from "@/components/Rating";
import { formatPrice, site } from "@/lib/site";
import type { Product } from "@/lib/types";

export default function BuyBox({ product }: { product: Product }) {
  const { add } = useCart();
  const [option, setOption] = useState(product.options?.values[0]);
  // نبدأ بأول لون متوفر بدل لون نفد مخزونه.
  const [color, setColor] = useState(
    product.colors?.find((c) => typeof c.stock !== "number" || c.stock > 0)?.name ??
      product.colors?.[0]?.name
  );
  const [qty, setQty] = useState(1);

  // مخزون اللون المختار إن كان مضبوطاً في لوحة المدير، وإلا المخزون الكلي.
  const selectedColor = product.colors?.find((c) => c.name === color);
  const colorStock =
    typeof selectedColor?.stock === "number" ? selectedColor.stock : null;
  const available = colorStock ?? product.stock;
  const maxQty = Math.max(0, Math.min(20, available));
  const lowStock = available > 0 && available <= 15;

  return (
    <div>
      <div className="flex items-center gap-3">
        <Rating value={product.rating} reviews={product.reviews} />
        <span className="text-[0.7rem] text-ink-mute">·</span>
        <span className="text-[0.7rem] font-semibold text-success">متوفر</span>
      </div>

      <h1 className="mt-2 text-2xl font-extrabold leading-tight text-ink sm:text-[2rem]">
        {product.name}
      </h1>
      <p className="mt-1 text-[0.84rem] text-ink-soft">{product.subtitle}</p>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="num text-[1.7rem] font-extrabold text-ink">
          {formatPrice(product.price)}
          <span className="ms-1.5 text-sm font-semibold text-ink-mute">{site.currency}</span>
        </span>
        {product.compareAt && (
          <>
            <span className="num text-[0.95rem] text-ink-mute line-through">
              {formatPrice(product.compareAt)}
            </span>
            <span className="num rounded-full bg-copper/12 px-2 py-0.5 text-[0.68rem] font-bold text-copper-dark">
              −{Math.round((1 - product.price / product.compareAt) * 100)}%
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-[0.7rem] text-ink-mute">السعر النهائي — لا توجد رسوم إضافية</p>

      <p className="mt-5 text-[0.9rem] leading-7 text-ink-soft">{product.description}</p>

      {/* Options */}
      {product.options && (
        <div className="mt-6">
          <p className="mb-2 text-[0.78rem] font-bold text-ink">
            {product.options.label}
            <span className="ms-2 font-normal text-ink-mute">{option}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {product.options.values.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setOption(v)}
                className={`rounded-full border px-4 py-2 text-[0.78rem] font-semibold transition-all ${
                  option === v
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-soft hover:border-copper"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {product.colors && (
        <div className="mt-5">
          <p className="mb-2 text-[0.78rem] font-bold text-ink">
            اللون
            <span className="ms-2 font-normal text-ink-mute">{color}</span>
            {typeof selectedColor?.stock === "number" && (
              <span
                className={`ms-2 text-[0.7rem] font-semibold ${
                  selectedColor.stock > 0 ? "text-success" : "text-danger"
                }`}
              >
                {selectedColor.stock > 0
                  ? `المتوفر: ${selectedColor.stock}`
                  : "نفد"}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => {
              const soldOut = typeof c.stock === "number" && c.stock <= 0;
              const stockLimit =
                typeof c.stock === "number" ? c.stock : product.stock;

              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={soldOut}
                  title={soldOut ? `${c.name} — نفد` : c.name}
                  onClick={() => {
                    setColor(c.name);
                    setQty((q) =>
                      Math.max(1, Math.min(q, Math.min(20, Math.max(0, stockLimit))))
                    );
                  }}
                  aria-label={soldOut ? `${c.name} — نفد` : c.name}
                  className={`relative grid size-9 place-items-center rounded-full border-2 transition-all ${
                    color === c.name ? "border-ink" : "border-transparent hover:border-line"
                  } ${soldOut ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span
                    className="size-6 rounded-full ring-1 ring-black/10"
                    style={{ background: c.hex }}
                  />
                  {soldOut && (
                    <span className="absolute inset-0 grid place-items-center text-[0.55rem] font-bold text-ink">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Qty + CTA */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-sand"
            aria-label="تقليل الكمية"
          >
            <MinusIcon className="size-4" />
          </button>
          <span className="num w-8 text-center text-sm font-bold">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="زيادة الكمية"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => add(product.id, { qty, option, color })}
          disabled={maxQty < 1}
          className="btn btn-primary min-w-[190px] flex-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {maxQty < 1 ? "غير متوفر" : "أضف إلى السلة"}
        </button>
      </div>

      <a
        href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
          `مرحباً، أرغب بطلب: ${product.name} ${option ?? ""}`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline mt-2.5 w-full"
      >
        اطلب عبر واتساب
      </a>

      {lowStock && (
        <p className="mt-3 text-center text-[0.72rem] font-semibold text-copper-dark">
          بقي {available} قطعة فقط في المخزون
        </p>
      )}

      {/* Assurances */}
      <div className="mt-6 grid gap-3 rounded-2xl border border-line-soft bg-white p-4 sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <StoreIcon className="mt-0.5 size-4 shrink-0 text-copper" />
          <div>
            <p className="text-[0.76rem] font-bold text-ink">الاستلام من المتجر</p>
            <p className="text-[0.7rem] text-ink-mute">بدون رسوم إضافية</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <ReturnIcon className="mt-0.5 size-4 shrink-0 text-copper" />
          <div>
            <p className="text-[0.76rem] font-bold text-ink">استبدال خلال 14 يوم</p>
            <p className="text-[0.7rem] text-ink-mute">بحالته الأصلية</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[0.7rem] text-ink-mute">
        هل تحتاج مساعدة في الاختيار؟{" "}
        <Link href="/contact" className="font-semibold text-copper-dark underline-offset-4 hover:underline">
          تواصل معنا
        </Link>
      </p>
    </div>
  );
}
