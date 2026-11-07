"use client";

import Link from "next/link";
import ProductArtwork from "@/components/ProductArtwork";
import { useCart } from "@/components/cart/CartProvider";
import { CloseIcon, MinusIcon, PlusIcon, StoreIcon } from "@/components/icons";
import { formatPrice, priceLabel, site } from "@/lib/site";

export default function CartPage() {
  const { detailed, subtotal, setQty, remove, ready, count, authenticated } = useCart();

  const total = subtotal;

  if (!ready) {
    return (
      <div className="container-x py-20 text-center text-sm text-ink-mute">
        جارٍ تحميل السلة…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="container-x flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-extrabold text-ink">سجّل دخولك لعرض سلتك</h1>
        <p className="mt-2 max-w-md text-sm leading-7 text-ink-soft">
          السلة مرتبطة بحسابك — سجّل دخولك لتجد قطعك على كل أجهزتك، من أي مكان.
        </p>
        <Link href="/account?next=/cart" className="btn btn-primary mt-6">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="container-x flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-extrabold text-ink">سلتك فارغة</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">
          لم تُضف أي قطعة بعد. ابدأ من الأكثر مبيعاً أو من الإصدارات الجديدة.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/categories" className="btn btn-primary">تصفّح الأقسام</Link>
          <Link href="/category/women-perfumes" className="btn btn-outline">العطور</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">سلة التسوق</h1>
      <p className="mt-1 mb-7 text-[0.82rem] text-ink-mute">{count} منتج في سلتك</p>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Lines */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-line-soft bg-white p-4 text-[0.78rem] font-semibold text-ink-soft">
            <StoreIcon className="size-4 shrink-0 text-copper" />
            <span>الاستلام من المتجر</span>
          </div>

          {detailed.map((line) => (
            <div
              key={line.key}
              className="flex gap-4 rounded-2xl border border-line-soft bg-white p-4"
            >
              <Link
                href={`/product/${line.product.slug}`}
                className="size-24 shrink-0 overflow-hidden rounded-xl bg-sand"
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
                  <div className="min-w-0">
                    <Link
                      href={`/product/${line.product.slug}`}
                      className="block truncate text-[0.95rem] font-bold text-ink hover:text-copper-dark"
                    >
                      {line.product.name}
                    </Link>
                    <p className="mt-0.5 text-[0.74rem] text-ink-mute">
                      {line.product.subtitle}
                    </p>
                    {(line.option || line.color) && (
                      <p className="mt-1 inline-block rounded-full bg-sand px-2 py-0.5 text-[0.68rem] font-semibold text-ink-soft">
                        {[line.option, line.color].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className="shrink-0 text-ink-mute transition-colors hover:text-maroon"
                    aria-label="حذف من السلة"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(line.key, line.qty - 1)}
                      className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sand"
                      aria-label="تقليل"
                    >
                      <MinusIcon className="size-3.5" />
                    </button>
                    <span className="num w-8 text-center text-sm font-bold">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(line.key, line.qty + 1)}
                      className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sand"
                      aria-label="زيادة"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </div>
                  <span className="num text-[0.95rem] font-extrabold text-ink">
                    {formatPrice(line.product.price * line.qty)}
                    <span className="ms-1 text-[0.66rem] font-normal text-ink-mute">
                      {site.currency}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}

          <Link
            href="/categories"
            className="inline-block py-2 text-[0.8rem] font-semibold text-ink-soft hover:text-ink"
          >
            ← متابعة التسوق
          </Link>
        </div>

        {/* Summary */}
        <aside className="sticky top-24 rounded-2xl border border-line-soft bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">ملخّص الطلب</h2>

          <div className="mt-4 space-y-2.5 text-[0.84rem]">
            <div className="flex justify-between">
              <span className="text-ink-soft">المجموع الفرعي</span>
              <span className="num font-semibold">{priceLabel(subtotal)}</span>
            </div>
            <div className="hairline my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-ink">الإجمالي</span>
              <span className="num text-lg font-extrabold text-ink">{priceLabel(total)}</span>
            </div>
            <p className="text-[0.68rem] text-ink-mute">لا توجد رسوم إضافية</p>
          </div>

          <Link href="/checkout" className="btn btn-primary mt-5 w-full">
            إتمام الطلب
          </Link>
          <p className="mt-3 text-center text-[0.68rem] leading-5 text-ink-mute">
            تظهر طرق الدفع المتاحة عند إتمام الطلب
            <br />
            الاستلام من المتجر
          </p>

          <div className="mt-4 rounded-xl bg-sand/70 p-3 text-[0.72rem] leading-6 text-ink-soft">
            بإتمام الطلب أنت توافق على{" "}
            <Link href="/terms" className="font-semibold text-copper-dark hover:underline">
              الشروط والأحكام
            </Link>{" "}
            و
            <Link href="/privacy" className="font-semibold text-copper-dark hover:underline">
              سياسة الخصوصية
            </Link>
            .
          </div>
        </aside>
      </div>
    </div>
  );
}
