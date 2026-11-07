"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@/lib/site";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
} from "@/lib/orders";

/**
 * لوحة حساب العميل: تحيّة + قائمة «طلباتي» + زر الخروج.
 *
 * الطلبات تصل مُرشّحة من الخادم (customer_id = جلسة العميل)، فلا يمكن
 * للعميل رؤية طلبات غيره. الخروج يمسح كوكي الجلسة.
 */
export default function AccountDashboard({
  email,
  name,
  orders,
}: {
  email: string;
  name?: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/account/session", { method: "DELETE" });
    } finally {
      router.push("/account");
      router.refresh();
    }
  }

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">حسابي</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
            {name ? `أهلاً، ${name}` : "أهلاً بك في حسابك"}
          </h1>
          <p className="mt-1 text-[0.82rem] text-ink-mute" dir="ltr">
            {email}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="btn btn-outline !px-5 !py-2 text-[0.78rem]"
        >
          {loggingOut ? "جارٍ الخروج…" : "خروج"}
        </button>
      </div>

      <div className="hairline my-7" />

      <h2 className="mb-4 text-base font-extrabold text-ink">طلباتي</h2>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-cream/60 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink">لا توجد طلبات بعد</p>
          <p className="mt-1 text-[0.78rem] text-ink-mute">
            عند إتمام طلب، سيظهر هنا مع تفاصيله وحالته.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-line-soft bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="num text-[0.78rem] font-bold text-ink">{o.id}</p>
                  <p className="mt-0.5 text-[0.7rem] text-ink-mute">
                    {new Date(o.createdAt).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-sand px-3 py-1 text-[0.7rem] font-bold text-ink-soft">
                  {ORDER_STATUS_LABEL[o.status ?? "new"]}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
                <span className="text-[0.76rem] text-ink-soft">
                  {o.items.reduce((n, i) => n + i.qty, 0)} قطعة ·{" "}
                  {PAYMENT_METHOD_LABEL[o.payment]}
                  {o.paymentStatus && o.paymentStatus !== "unpaid" && (
                    <span className="text-ink-mute">
                      {" "}
                      · {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                    </span>
                  )}
                </span>
                <span className="num font-extrabold text-ink">
                  {formatPrice(o.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
