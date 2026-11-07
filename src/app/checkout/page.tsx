"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProductArtwork from "@/components/ProductArtwork";
import { useCart } from "@/components/cart/CartProvider";
import { ChevronIcon, ShieldIcon, StoreIcon } from "@/components/icons";
import { formatPrice, priceLabel, site } from "@/lib/site";
import { saveOrder, type Order } from "@/lib/orders";

type PaymentChoice = "cod" | "transfer" | "wallet";

type PaymentMethodInfo = {
  id: string;
  type: "bank" | "wallet";
  name: string;
  accountName: string;
  accountNumber: string;
  note: string;
};

type CheckoutConfig = {
  transferHoldDays: number;
  methods: PaymentMethodInfo[];
};

type Errors = Partial<Record<"name" | "phone", string>>;

/**
 * إتمام الطلب — بلا شحن ولا توصيل.
 *
 * الطلب يُستلم من المتجر أو يُرتَّب عبر واتساب، فلا نطلب مدينة ولا عنواناً
 * ولا طريقة شحن، والمجموع = المجموع الفرعي بلا رسوم إضافية.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { detailed, count, subtotal, ready, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentChoice>("cod");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // بيانات الحساب البنكي تأتي من الخادم (تُعدّل من لوحة المدير).
  const [config, setConfig] = useState<CheckoutConfig | null>(null);

  // الإتمام للعملاء المسجّلين فقط — السلة والطلب مرتبطان بالحساب.
  useEffect(() => {
    let alive = true;
    fetch("/api/account/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (!d?.ok) {
          router.replace("/account?next=/checkout");
          return;
        }
        if (d.user?.name) setName((current) => current || String(d.user.name));
      })
      .catch(() => {
        if (alive) router.replace("/account?next=/checkout");
      });
    return () => {
      alive = false;
    };
  }, [router]);

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
        // لا توجد طرق دفع غير نقدية؟ نُبقي «عند الاستلام» هي الاختيار الآمن.
        if (!Array.isArray(d.methods) || d.methods.length === 0) {
          setPayment("cod");
          setPaymentMethodId("");
        }
      })
      .catch(() => {
        if (alive) setConfig(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const methods = config?.methods ?? [];
  const bankMethods = methods.filter((method) => method.type === "bank");
  const walletMethods = methods.filter((method) => method.type === "wallet");
  const selectedMethod = methods.find((method) => method.id === paymentMethodId) ?? null;
  const total = subtotal;

  function validate(): boolean {
    const next: Errors = {};
    if (name.trim().length < 3) next.name = "أدخل الاسم الكامل";
    if (!/^(7\d{8}|\+9677\d{8})$/.test(phone.replace(/\s/g, "")))
      next.phone = "أدخل رقم جوال يمني صحيح (7xxxxxxxx أو +9677xxxxxxxx)";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || submitting) return;

    if (payment !== "cod" && !selectedMethod) {
      setSubmitError("اختر طريقة الدفع التي حوّلت عليها أولاً");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // الأسعار تُعاد حسابها على الخادم — نرسل المعرّفات والكميات فقط.
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: detailed.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          option: l.option,
          color: l.color,
        })),
        customer: { name, phone, notes },
        payment,
        paymentMethodId: payment === "cod" ? undefined : selectedMethod?.id,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setSubmitError(data?.error ?? "تعذّر إتمام الطلب. حاول مرة أخرى.");
          setSubmitting(false);
          return;
        }
        // نسخة محلية لعرض صفحة التأكيد — الأصل محفوظ على الخادم.
        saveOrder(data.order as Order);

        clear();
        // التحويل/المحفظة: صفحة الطلب تعرض بيانات الطريقة وزر رفع الإيصال.
        const suffix = payment === "cod" ? "" : "?receipt=1";
        router.push(`/order/${(data.order as Order).id}${suffix}`);
      })
      .catch(() => {
        setSubmitError("تعذّر الاتصال بالخادم. تحقّق من الشبكة وحاول مرة أخرى.");
        setSubmitting(false);
      });
  }

  if (!ready) {
    return (
      <div className="container-x py-20 text-center text-sm text-ink-mute">
        جارٍ تحميل الطلب…
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="container-x flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-extrabold text-ink">لا يوجد ما يمكن إتمامه</h1>
        <p className="mt-2 max-w-sm text-sm leading-7 text-ink-soft">
          سلتك فارغة. أضف قطعة واحدة على الأقل قبل إتمام الطلب.
        </p>
        <Link href="/categories" className="btn btn-primary mt-6">
          تصفّح المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-[0.72rem] text-ink-mute">
        <Link href="/cart" className="hover:text-copper-dark">السلة</Link>
        <ChevronIcon className="size-3" />
        <span className="font-semibold text-ink">إتمام الطلب</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">إتمام الطلب</h1>
      <p className="mt-1 mb-7 text-[0.82rem] text-ink-mute">
        {count} منتج ·{" "}
        {methods.length > 0
          ? "الدفع عند الاستلام أو تحويل بنكي أو محفظة"
          : "الدفع عند الاستلام"}
      </p>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-4">
          {/* ── بيانات المستلم ─────────────────────── */}
          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-ink">
              <span className="num grid size-6 place-items-center rounded-full bg-ink text-[0.68rem] text-white">
                ١
              </span>
              بيانات المستلم
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الاسم الكامل" error={errors.name}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: نورة العتيبي"
                  autoComplete="name"
                  className={inputCls(errors.name)}
                />
              </Field>

              <Field label="رقم الجوال" error={errors.phone} hint="لتأكيد الطلب">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="7xxxxxxxx"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="tel"
                  className={`${inputCls(errors.phone)} text-right`}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="ملاحظات (اختياري)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="أي تفاصيل إضافية عن طلبك"
                    className={`${inputCls()} resize-none`}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* ── الاستلام ───────────────────────────── */}
          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-ink">
              <span className="num grid size-6 place-items-center rounded-full bg-ink text-[0.68rem] text-white">
                ٢
              </span>
              الاستلام
            </h2>

            <div className="flex items-start gap-3 rounded-xl border border-copper/30 bg-copper/5 p-3.5">
              <StoreIcon className="mt-0.5 size-4.5 shrink-0 text-copper" />
              <div className="text-[0.78rem] leading-6 text-ink-soft">
                <p className="font-bold text-ink">الاستلام من المتجر</p>
                <p className="mt-1">
                  بعد تأكيد الطلب نتواصل معك على واتساب لتحديد موعد الاستلام.
                </p>
              </div>
            </div>
          </section>

          {/* ── الدفع ──────────────────────────────── */}
          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-ink">
              <span className="num grid size-6 place-items-center rounded-full bg-ink text-[0.68rem] text-white">
                ٣
              </span>
              طريقة الدفع
            </h2>

            <div className="space-y-3">
              <OptionCard
                checked={payment === "cod"}
                onChange={() => {
                  setPayment("cod");
                  setPaymentMethodId("");
                }}
                title="الدفع عند الاستلام"
                subtitle="تدفع عند استلام طلبك من المتجر"
                price="متاح"
                horizontal
              />

              {bankMethods.length > 0 && (
                <>
                  <OptionCard
                    checked={payment === "transfer"}
                    onChange={() => {
                      setPayment("transfer");
                      setPaymentMethodId((current) =>
                        bankMethods.some((method) => method.id === current)
                          ? current
                          : bankMethods[0].id
                      );
                    }}
                    title="تحويل بنكي"
                    subtitle="حوّل المبلغ ثم ارفع صورة الإيصال من صفحة الطلب ليعتمدها المدير"
                    price="متاح"
                    horizontal
                  />
                  {payment === "transfer" && (
                    <div className="ms-4 grid gap-2 sm:grid-cols-2">
                      {bankMethods.map((method) => (
                        <MethodChip
                          key={method.id}
                          method={method}
                          selected={paymentMethodId === method.id}
                          onSelect={() => setPaymentMethodId(method.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {walletMethods.length > 0 && (
                <>
                  <OptionCard
                    checked={payment === "wallet"}
                    onChange={() => {
                      setPayment("wallet");
                      setPaymentMethodId((current) =>
                        walletMethods.some((method) => method.id === current)
                          ? current
                          : walletMethods[0].id
                      );
                    }}
                    title="محفظة إلكترونية"
                    subtitle="جوالي · جيب · حاسب · فلوسك · ون كاش — حوّل ثم ارفع الإيصال"
                    price="متاح"
                    horizontal
                  />
                  {payment === "wallet" && (
                    <div className="ms-4 grid gap-2 sm:grid-cols-2">
                      {walletMethods.map((method) => (
                        <MethodChip
                          key={method.id}
                          method={method}
                          selected={paymentMethodId === method.id}
                          onSelect={() => setPaymentMethodId(method.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {payment !== "cod" && selectedMethod && (
              <div className="mt-4 rounded-xl border border-copper/30 bg-copper/5 p-3.5">
                <p className="mb-2 text-[0.76rem] font-bold text-ink">
                  {selectedMethod.type === "bank" ? "بيانات الحساب البنكي" : "بيانات المحفظة"} —{" "}
                  {selectedMethod.name}
                </p>
                <dl className="space-y-1.5 text-[0.78rem]">
                  {selectedMethod.accountName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-mute">صاحب الحساب</dt>
                      <dd className="font-semibold text-ink">{selectedMethod.accountName}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-ink-mute">
                      {selectedMethod.type === "bank" ? "رقم الحساب / الآيبان" : "رقم المحفظة"}
                    </dt>
                    <dd className="num select-all font-bold text-ink" dir="ltr">
                      {selectedMethod.accountNumber}
                    </dd>
                  </div>
                </dl>
                {selectedMethod.note && (
                  <p className="mt-2 rounded-lg bg-white/70 p-2 text-[0.72rem] leading-6 text-ink-soft">
                    {selectedMethod.note}
                  </p>
                )}
                <p className="mt-2 text-[0.7rem] leading-5 text-ink-mute">
                  بعد إنشاء الطلب، افتح صفحة الطلب وارفع صورة الإيصال خلال{" "}
                  {config?.transferHoldDays ?? site.transferHoldDays} أيام، وإلا يُلغى الطلب
                  تلقائياً ويُحرّر المخزون.
                </p>
              </div>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-[0.7rem] leading-5 text-ink-mute">
              <ShieldIcon className="mt-0.5 size-3.5 shrink-0 text-copper" />
              بياناتك تُستخدم لتنفيذ الطلب فقط ولا تُشارك مع أي طرف ثالث.
            </p>
          </section>

          {/* ── الطلب ──────────────────────────────── */}
          <section className="rounded-2xl border border-line-soft bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-ink">
              <span className="num grid size-6 place-items-center rounded-full bg-ink text-[0.68rem] text-white">
                ٤
              </span>
              مراجعة القطع
            </h2>

            <ul className="divide-y divide-line-soft">
              {detailed.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-3">
                  <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                    <ProductArtwork
                      kind={l.product.artwork}
                      tone={l.product.tone}
                      className="size-full"
                      strokeScale={2.4}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84rem] font-bold text-ink">
                      {l.product.name}
                    </p>
                    <p className="text-[0.7rem] text-ink-mute">
                      {[l.option, l.color].filter(Boolean).join(" · ") || l.product.subtitle}
                    </p>
                  </div>
                  <span className="num text-[0.72rem] text-ink-mute">×{l.qty}</span>
                  <span className="num text-[0.82rem] font-bold text-ink">
                    {formatPrice(l.product.price * l.qty)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Summary ──────────────────────────────── */}
        <aside className="rounded-2xl border border-line-soft bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-extrabold text-ink">ملخّص الطلب</h2>

          <div className="mt-4 space-y-2.5 text-[0.84rem]">
            <Row label="المجموع الفرعي" value={priceLabel(subtotal)} />
            <div className="hairline my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-ink">الإجمالي</span>
              <span className="num text-lg font-extrabold text-ink">{priceLabel(total)}</span>
            </div>
            <p className="text-[0.68rem] text-ink-mute">
              لا توجد رسوم إضافية — السعر النهائي كما هو.
            </p>
          </div>

          {submitError && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-maroon/25 bg-maroon/5 px-3 py-2.5 text-[0.74rem] font-semibold leading-6 text-maroon"
            >
              {submitError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary mt-4 w-full">
            {submitting ? "جارٍ تأكيد الطلب…" : "تأكيد الطلب"}
          </button>

          <p className="mt-3 text-center text-[0.68rem] leading-5 text-ink-mute">
            بالضغط على «تأكيد الطلب» أنت توافق على{" "}
            <Link href="/terms" className="font-semibold text-copper-dark hover:underline">
              الشروط والأحكام
            </Link>
          </p>

          <Link
            href="/cart"
            className="mt-3 block text-center text-[0.74rem] font-semibold text-ink-soft hover:text-ink"
          >
            العودة إلى السلة
          </Link>
        </aside>
      </form>
    </div>
  );
}

/* ── Small building blocks ───────────────────────────────── */

function inputCls(error?: string) {
  return `w-full rounded-xl border bg-cream px-3.5 py-2.5 text-[0.86rem] outline-none transition-colors placeholder:text-ink-mute ${
    error ? "border-maroon/50 focus:border-maroon" : "border-line focus:border-copper"
  }`;
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[0.76rem] font-bold text-ink">{label}</span>
        {hint && !error && <span className="text-[0.64rem] text-ink-mute">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[0.68rem] font-semibold text-maroon">{error}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}

function MethodChip({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethodInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border px-3 py-2 text-start text-[0.78rem] font-semibold transition-colors ${
        selected
          ? "border-copper bg-white text-ink shadow-[0_0_0_1px_var(--color-copper)_inset]"
          : "border-line bg-white/70 text-ink-soft hover:border-copper/50"
      }`}
    >
      {method.name}
    </button>
  );
}

function OptionCard({
  checked,
  onChange,
  title,
  subtitle,
  price,
  horizontal = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
  price: string;
  horizontal?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
        disabled
          ? "cursor-not-allowed border-line-soft bg-cream/60 opacity-60"
          : checked
            ? "border-copper bg-copper/5 shadow-[0_0_0_1px_var(--color-copper)_inset]"
            : "border-line bg-white hover:border-copper/50"
      } ${horizontal ? "" : "flex-col"}`}
    >
      <span className="flex w-full items-start gap-3">
        <input
          type="radio"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-copper)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.82rem] font-bold text-ink">{title}</span>
          <span className="mt-0.5 block text-[0.7rem] text-ink-mute">{subtitle}</span>
        </span>
        <span className="shrink-0 text-[0.74rem] font-bold text-copper-dark">{price}</span>
      </span>
    </label>
  );
}
