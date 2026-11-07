"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProductArtwork from "@/components/ProductArtwork";
import { WhatsAppIcon } from "@/components/icons";
import { formatPrice, priceLabel, site } from "@/lib/site";
import {
  getOrder,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
  type PaymentStatus,
} from "@/lib/orders";

const payStyle: Record<PaymentStatus, string> = {
  unpaid: "bg-ink/8 text-ink-soft",
  pending: "bg-amber-400/15 text-amber-700",
  paid: "bg-success/12 text-success",
  failed: "bg-maroon/10 text-maroon",
  refunded: "bg-indigo-500/10 text-indigo-700",
};

type PaymentMethodInfo = {
  id: string;
  type: "bank" | "wallet";
  name: string;
  accountName: string;
  accountNumber: string;
  note: string;
};

type Config = {
  transferHoldDays: number;
  methods: PaymentMethodInfo[];
};

export default function OrderView() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id));
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // نجلب نسخة الخادم للحصول على أحدث حالة دفع (الكتالوج المحلي قد يكون
    // قديماً بعد رفع الإيصال/اعتماده). إن تعذّر الجلب نعرض نسخة سجل المتصفح.
    fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setOrder(d?.ok && d.order ? (d.order as Order) : getOrder(id));
      })
      .catch(() => {
        if (!cancelled) setOrder(getOrder(id));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // طرق الدفع (تُعدّل من لوحة المدير) — لعرض بيانات التحويل/المحفظة.
  useEffect(() => {
    let alive = true;
    fetch("/api/checkout/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.ok) return;
        setConfig({
          transferHoldDays: Number(d.transferHoldDays ?? site.transferHoldDays),
          methods: Array.isArray(d.methods) ? d.methods : [],
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data.order) setOrder(data.order as Order);
  }

  async function uploadProof(file: File) {
    if (!order || uploading) return;
    setUploading(true);
    setUploadError(null);
    setNotice(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.id)}/proof`,
        { method: "POST", body: form }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setUploadError(data?.error ?? "تعذّر رفع الإيصال، حاول مرة أخرى.");
        return;
      }
      await refresh();
      setNotice("تم رفع الإيصال — سيظهر للمدير لمراجعته واعتماده.");
    } catch {
      setUploadError("تعذّر الاتصال بالخادم. تحقّق من الشبكة وحاول مرة أخرى.");
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="container-x py-20 text-center text-sm text-ink-mute">
        جارٍ تحميل الطلب…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-x flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-extrabold text-ink">لم نجد هذا الطلب</h1>
        <p className="mt-2 max-w-sm text-sm leading-7 text-ink-soft">
          تُعرض صفحة الطلب من سجل هذا المتصفح. إن كنت قد أكملت الطلب للتو ولم تظهر
          التفاصيل، راسلنا على واتساب برقم الطلب وسنجده في سجلاتنا.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/categories" className="btn btn-primary">تصفّح المتجر</Link>
          <a
            href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`استفسار عن الطلب ${id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            <WhatsAppIcon className="size-4" />
            واتساب
          </a>
        </div>
      </div>
    );
  }

  const date = new Date(order.createdAt).toLocaleDateString("ar-YE-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const payStatus = order.paymentStatus ?? "unpaid";
  const isPrepaid = order.payment === "transfer" || order.payment === "wallet";
  const expectedType = order.payment === "transfer" ? "bank" : "wallet";
  const method =
    config?.methods.find((item) => item.id === order.paymentMethodId) ??
    config?.methods.find((item) => item.type === expectedType) ??
    null;
  const canUpload = isPrepaid && payStatus !== "paid" && order.status !== "cancelled";

  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-3xl">
        {/* Confirmation header */}
        <div className="rounded-2xl border border-line-soft bg-white p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success">
            <svg viewBox="0 0 24 24" fill="none" className="size-7">
              <path
                d="m5 12.5 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-ink">تم استلام طلبك</h1>
          <p className="mt-2 text-[0.86rem] leading-7 text-ink-soft">
            سنتواصل معك على {order.customer.phone} لتأكيد الطلب خلال ساعات العمل.
          </p>

          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl bg-cream px-5 py-3 text-[0.78rem]">
            <span>
              رقم الطلب:{" "}
              <span className="num font-bold text-ink" dir="ltr">
                {order.id}
              </span>
            </span>
            <span className="text-ink-mute">·</span>
            <span className="text-ink-soft">{date}</span>
          </div>
        </div>

        {/* ── الدفع المسبق (تحويل/محفظة): البيانات + الإيصال ── */}
        {isPrepaid && (
          <section className="mt-4 rounded-2xl border border-line-soft bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink">
                {order.payment === "transfer" ? "تحويل بنكي" : "محفظة إلكترونية"}
                {method?.name ? ` — ${method.name}` : ""}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[0.66rem] font-bold ${payStyle[payStatus]}`}
              >
                {PAYMENT_STATUS_LABEL[payStatus]}
              </span>
            </div>

            {notice && (
              <p className="mb-3 rounded-xl border border-success/30 bg-success/8 px-3 py-2.5 text-[0.76rem] font-semibold leading-6 text-success">
                {notice}
              </p>
            )}

            {payStatus === "failed" && (
              <p className="mb-3 rounded-xl border border-maroon/25 bg-maroon/5 px-3 py-2.5 text-[0.76rem] font-semibold leading-6 text-maroon">
                {order.paymentReviewNote
                  ? `رُفض الإيصال: ${order.paymentReviewNote}`
                  : "رُفض الإيصال — يرجى رفع صورة واضحة لإيصال التحويل."}
              </p>
            )}

            {payStatus === "paid" ? (
              <p className="text-[0.82rem] leading-7 text-ink-soft">
                تم اعتماد تحويلك بنجاح. لا تحتاج إلى أي إجراء آخر.
              </p>
            ) : order.status === "cancelled" ? (
              <p className="text-[0.82rem] leading-7 text-ink-soft">
                أُلغي هذا الطلب. تواصل معنا على واتساب إن كنت قد حوّلت المبلغ.
              </p>
            ) : (
              <>
                {!method && (
                  <p className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2.5 text-[0.76rem] leading-6 text-amber-700">
                    بيانات هذه الطريقة لم تُضبط بعد. راسلنا على واتساب وسنرسل لك
                    بيانات التحويل.
                  </p>
                )}

                {method && (
                  <div className="rounded-xl border border-copper/25 bg-copper/5 p-3.5">
                    <dl className="space-y-1.5 text-[0.8rem]">
                      {method.accountName && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-mute">صاحب الحساب</dt>
                          <dd className="font-semibold text-ink">{method.accountName}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-ink-mute">
                          {method.type === "bank" ? "رقم الحساب / الآيبان" : "رقم المحفظة"}
                        </dt>
                        <dd className="num select-all font-bold text-ink" dir="ltr">
                          {method.accountNumber}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-mute">المبلغ</dt>
                        <dd className="num font-extrabold text-copper-dark">
                          {priceLabel(order.total)}
                        </dd>
                      </div>
                    </dl>
                    {method.note && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-[0.72rem] leading-6 text-ink-soft">
                        {method.note}
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 text-[0.74rem] leading-6 text-ink-soft">
                  {order.paymentProofPath
                    ? "تم استلام إيصالك وهو بانتظار مراجعة المدير. يمكنك رفع إيصال أوضح إن أردت."
                    : "حوّل المبلغ إلى الحساب أعلاه ثم ارفع صورة الإيصال هنا ليعتمده المدير."}
                </p>

                {canUpload && (
                  <div className="mt-3">
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-copper bg-copper/5 px-4 py-2 text-[0.78rem] font-bold text-copper-dark hover:bg-copper/10 ${
                        uploading ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadProof(file);
                        }}
                        className="sr-only"
                      />
                      {uploading ? "جارٍ رفع الإيصال…" : "رفع صورة الإيصال"}
                    </label>
                    <p className="mt-1.5 text-[0.68rem] text-ink-mute">
                      JPG أو PNG أو WEBP أو PDF — حتى 5 ميجابايت. يُلغى الطلب
                      تلقائياً بعد {config?.transferHoldDays ?? site.transferHoldDays} أيام
                      بلا إيصال معتمد.
                    </p>
                    {uploadError && (
                      <p className="mt-2 rounded-xl border border-maroon/25 bg-maroon/5 px-3 py-2 text-[0.72rem] font-semibold text-maroon">
                        {uploadError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Items */}
        <section className="mt-4 rounded-2xl border border-line-soft bg-white p-5">
          <h2 className="mb-2 text-base font-extrabold text-ink">القطع</h2>
          <ul className="divide-y divide-line-soft">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                  <ProductArtwork
                    kind={it.artwork}
                    tone={it.tone}
                    className="size-full"
                    strokeScale={2.4}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${it.slug}`}
                    className="block truncate text-[0.86rem] font-bold text-ink hover:text-copper-dark"
                  >
                    {it.name}
                  </Link>
                  <p className="text-[0.7rem] text-ink-mute">
                    {[it.option, it.color].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="num text-[0.72rem] text-ink-mute">×{it.qty}</span>
                <span className="num text-[0.84rem] font-bold text-ink">
                  {formatPrice(it.price * it.qty)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Details grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-3 text-sm font-extrabold text-ink">بيانات الطلب</h2>
            <dl className="space-y-1.5 text-[0.8rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">الاسم</dt>
                <dd className="font-semibold text-ink">{order.customer.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">الجوال</dt>
                <dd className="num font-semibold text-ink" dir="ltr">
                  {order.customer.phone}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">الاستلام</dt>
                <dd className="font-semibold text-ink">من المتجر</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">الدفع</dt>
                <dd className="flex flex-col items-end gap-1 font-semibold text-ink">
                  <span>{PAYMENT_METHOD_LABEL[order.payment]}</span>
                  {(isPrepaid || payStatus !== "unpaid") && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.62rem] font-bold ${payStyle[payStatus]}`}
                    >
                      {PAYMENT_STATUS_LABEL[payStatus]}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {order.customer.notes && (
              <p className="mt-3 rounded-lg bg-cream p-2.5 text-[0.74rem] leading-6 text-ink-soft">
                {order.customer.notes}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-3 text-sm font-extrabold text-ink">الفاتورة</h2>
            <dl className="space-y-2 text-[0.82rem]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">المجموع الفرعي</dt>
                <dd className="num font-semibold">{priceLabel(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>خصم {order.couponCode}</dt>
                  <dd className="num font-semibold">− {priceLabel(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">الاستلام</dt>
                <dd className="font-semibold text-success">من المتجر — بلا رسوم</dd>
              </div>
              <div className="hairline my-1" />
              <div className="flex items-baseline justify-between">
                <dt className="font-bold text-ink">الإجمالي</dt>
                <dd className="num text-base font-extrabold text-ink">
                  {priceLabel(order.total)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/categories" className="btn btn-primary flex-1">
            متابعة التسوق
          </Link>
          <a
            href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
              `مرحباً، استفسار عن الطلب ${order.id}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline flex-1"
          >
            <WhatsAppIcon className="size-4" />
            تابع طلبك على واتساب
          </a>
        </div>

        <p className="mt-5 text-center text-[0.7rem] leading-6 text-ink-mute">
          {isPrepaid
            ? payStatus === "paid"
              ? "تم اعتماد دفعك بنجاح. الطلب مسجّل في المتجر."
              : "الطلب مسجّل في المتجر. ارفع إيصال الدفع ليعتمده المدير ضمن المهلة المحددة."
            : "الطلب مسجّل في المتجر. الدفع عند الاستلام — لا يُطلب منك دفع أي مبلغ الآن."}
        </p>
      </div>
    </div>
  );
}
