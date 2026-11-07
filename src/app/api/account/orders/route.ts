import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer";
import { readOrdersByCustomer } from "@/lib/orders/store";

/**
 * طلبات العميل الحالي فقط.
 *
 * تُقرأ الجلسة من كوكي `HttpOnly`، وتُرجَع الطلبات المرتبطة بمعرّفه
 * عبر `customer_id`. لا يمكن لعميل رؤية طلبات غيره.
 *
 * تُبنى الطلبات في طبقة التخزين من الأعمدة المتبقية في قاعدة البيانات فقط.
 */

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

export async function GET(request: Request) {
  const session = customerFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "غير مصرّح" }, { status: 401 });
  }

  try {
    const orders = await readOrdersByCustomer(session.uid);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[account/orders] read failed", err);
    return NextResponse.json(
      { ok: false, error: "تعذّر قراءة الطلبات" },
      { status: 500 }
    );
  }
}
