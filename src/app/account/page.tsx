import type { Metadata } from "next";
import { connection } from "next/server";
import { currentCustomer } from "@/lib/customer";
import { readOrdersByCustomer } from "@/lib/orders/store";
import AccountGate from "@/components/account/AccountGate";
import AccountDashboard from "@/components/account/AccountDashboard";

export const metadata: Metadata = {
  title: "حسابي",
  robots: { index: false, follow: false },
};

// تقرأ كوكي الجلسة (وقد تقرأ searchParams) عند الطلب — مسار ديناميكي.
export const instant = false;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // الجلسة تعتمد على وقت الطلب (انتهاء التوكن) — نؤجّل الصفحة للطلب
  // بدل محاولة توليدها وقت البناء (قيد Cache Components في Next 16).
  await connection();

  const params = await searchParams;
  const next =
    typeof params.next === "string" &&
    params.next.startsWith("/") &&
    !params.next.startsWith("//")
      ? params.next
      : "/account";

  const session = await currentCustomer();

  // غير مسجّل → شاشة دخول/تسجيل.
  if (!session) {
    return <AccountGate nextPath={next} />;
  }

  // مسجّل → لوحة الحساب مع طلباته.
  const orders = await readOrdersByCustomer(session.uid);
  return (
    <AccountDashboard
      email={session.email}
      name={session.name}
      orders={orders}
    />
  );
}
