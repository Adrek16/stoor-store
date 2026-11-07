import { NextResponse } from "next/server";
import { readOrder } from "@/lib/orders/store";
import { customerFromRequest } from "@/lib/customer";
import { orderIdsFromRequest } from "@/lib/order-access";

/**
 * يُرجع طلباً واحداً بالمعرّف — يستعمله العميل لعرض أحدث حالة دفع
 * (مثلاً بعد رفع إيصال التحويل أو اعتماده من المدير).
 *
 * ⚠️ الطلب يحتوي بيانات شخصية (اسم/جوال)، لذا لا يُرجع لأي زائر
 * يعرف المعرّف فقط. يُسمح بالقراءة لحالتين فقط:
 *   - العميل صاحب الطلب (`customer_id` = معرّف جلسته)،
 *   - المتصفح الذي أنشأ الطلب (كوكي `stoor_orders` الموقّع).
 *
 * الطلبات القديمة بمعرّف قصير (6 أرقام) كانت قابلة للتعداد — هذا الحاجز
 * يغلقها تماماً، ويُرجع 404 موحّداً كي لا نكشف وجود الطلب من عدمه.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await readOrder(decodeURIComponent(id));

  const customer = customerFromRequest(request);
  const allowed =
    (customer !== null && order?.customerId === customer.uid) ||
    (order !== null && orderIdsFromRequest(request).includes(order.id));

  if (!order || !allowed) {
    return NextResponse.json(
      { ok: false, error: "الطلب غير موجود" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, order },
    { headers: { "Cache-Control": "no-store" } }
  );
}
