"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import ProductArtwork from "@/components/ProductArtwork";
import { CloseIcon, MinusIcon, PlusIcon, StoreIcon } from "@/components/icons";
import { formatPrice, priceLabel, site } from "@/lib/site";

export default function CartDrawer() {
  const { isOpen, close, detailed, subtotal, setQty, remove, count, authenticated } = useCart();

  return (
    <div
      className={`fixed inset-0 z-[60] overflow-hidden ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={close}
        className={`absolute inset-0 bg-ink/45 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="سلة التسوق"
        className={`absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-cream shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">سلة التسوق</h2>
            <p className="text-xs text-ink-mute">{count} منتج</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid size-9 place-items-center rounded-full hover:bg-sand"
            aria-label="إغلاق السلة"
          >
            <CloseIcon />
          </button>
        </div>

        {/* الاستلام من المتجر */}
        <div className="flex items-center gap-2 border-b border-line bg-sand/50 px-5 py-3 text-[0.78rem] font-semibold text-ink-soft">
          <StoreIcon className="size-4 text-copper" />
          <span>الاستلام من المتجر</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!authenticated ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-sand text-copper">
                <svg viewBox="0 0 24 24" fill="none" className="size-7">
                  <path d="M4 7h16l-1.3 11.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8L4 7Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 7a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="font-semibold">سجّل دخولك لعرض سلتك</p>
              <p className="mt-1 mb-5 text-sm text-ink-mute">
                سلتك مرتبطة بحسابك وتتبعك على كل أجهزتك
              </p>
              <Link href="/account?next=/cart" onClick={close} className="btn btn-primary">
                تسجيل الدخول
              </Link>
            </div>
          ) : detailed.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-sand text-copper">
                <svg viewBox="0 0 24 24" fill="none" className="size-7">
                  <path d="M4 7h16l-1.3 11.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8L4 7Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 7a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="font-semibold">سلتك فارغة</p>
              <p className="mt-1 mb-5 text-sm text-ink-mute">ابدأ من الأكثر مبيعاً أو وصل حديثاً</p>
              <Link href="/category/women-perfumes" onClick={close} className="btn btn-primary">
                تصفّح العطور
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {detailed.map((line) => (
                <li key={line.key} className="flex gap-3 rounded-2xl border border-line-soft bg-white p-3">
                  <Link
                    href={`/product/${line.product.slug}`}
                    onClick={close}
                    className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand"
                  >
                    <ProductArtwork
                      kind={line.product.artwork}
                      tone={line.product.tone}
                      className="size-full"
                      strokeScale={2}
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${line.product.slug}`}
                        onClick={close}
                        className="truncate text-sm font-bold hover:text-copper-dark"
                      >
                        {line.product.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(line.key)}
                        className="shrink-0 text-ink-mute transition-colors hover:text-maroon"
                        aria-label="حذف"
                      >
                        <CloseIcon className="size-4" />
                      </button>
                    </div>
                    {(line.option || line.color) && (
                      <p className="mt-0.5 text-[0.72rem] text-ink-mute">
                        {[line.option, line.color].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-line">
                        <button
                          type="button"
                          onClick={() => setQty(line.key, line.qty - 1)}
                          className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-sand"
                          aria-label="تقليل"
                        >
                          <MinusIcon className="size-3.5" />
                        </button>
                        <span className="num w-7 text-center text-sm font-bold">{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(line.key, line.qty + 1)}
                          className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-sand"
                          aria-label="زيادة"
                        >
                          <PlusIcon className="size-3.5" />
                        </button>
                      </div>
                      <span className="num text-sm font-bold">
                        {formatPrice(line.product.price * line.qty)}{" "}
                        <span className="text-[0.65rem] font-normal text-ink-mute">{site.currency}</span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {detailed.length > 0 && (
          <div className="border-t border-line bg-white px-5 py-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">المجموع الفرعي</span>
              <span className="num font-bold">{priceLabel(subtotal)}</span>
            </div>
            <p className="mb-3 text-[0.72rem] text-ink-mute">
              المجموع النهائي — الاستلام من المتجر
            </p>
            <Link href="/checkout" onClick={close} className="btn btn-primary w-full">
              إتمام الطلب
            </Link>
            <Link
              href="/cart"
              onClick={close}
              className="mt-2 block w-full py-2 text-center text-xs font-semibold text-ink-soft hover:text-ink"
            >
              عرض السلة
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
