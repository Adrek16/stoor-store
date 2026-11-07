import { Suspense } from "react";
import type { Metadata } from "next";
import OrderView from "./OrderView";

export const metadata: Metadata = {
  title: "تأكيد الطلب",
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="container-x py-20 text-center text-sm text-ink-mute">
          جارٍ تحميل الطلب…
        </div>
      }
    >
      <OrderView />
    </Suspense>
  );
}
