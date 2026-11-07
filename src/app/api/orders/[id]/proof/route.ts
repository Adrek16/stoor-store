import { NextResponse } from "next/server";
import { readOrder, updateOrderPayment } from "@/lib/orders/store";
import { customerFromRequest } from "@/lib/customer";
import { orderIdsFromRequest } from "@/lib/order-access";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  isProofType,
  PROOF_MAX_BYTES,
  storageConfigured,
  uploadObject,
} from "@/lib/storage";

/**
 * رفع صورة إيصال التحويل البنكي.
 *
 * POST multipart/form-data — الحقل `file`.
 * يُقبل من صاحب الطلب فقط (جلسة العميل أو المتصفح الذي أنشأ الطلب)،
 * وفقط لطلبات التحويل غير المدفوعة وغير الملغاة.
 *
 * الحالة تعود إلى «بانتظار المراجعة» وتُمسح ملاحظة الرفض السابقة،
 * حتى يستطيع العميل تصحيح إيصاله بعد الرفض.
 */

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(`orders:proof:${clientIp(request)}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "عدد المحاولات كبير — انتظر قليلاً ثم أعد المحاولة" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const { id } = await params;
  const orderId = decodeURIComponent(id);
  const order = await readOrder(orderId);

  const customer = customerFromRequest(request);
  const allowed =
    order !== null &&
    ((customer !== null && order.customerId === customer.uid) ||
      orderIdsFromRequest(request).includes(order.id));

  if (!order || !allowed) {
    return NextResponse.json(
      { ok: false, error: "الطلب غير موجود" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (order.payment !== "transfer" && order.payment !== "wallet") {
    return NextResponse.json(
      { ok: false, error: "هذا الطلب ليس دفعاً مسبقاً (تحويل/محفظة)" },
      { status: 400 }
    );
  }
  if (order.status === "cancelled") {
    return NextResponse.json(
      { ok: false, error: "الطلب ملغي — لا يمكن إرفاق إيصال" },
      { status: 409 }
    );
  }
  if (order.paymentStatus === "paid") {
    return NextResponse.json(
      { ok: false, error: "تم اعتماد دفع هذا الطلب مسبقاً" },
      { status: 409 }
    );
  }
  if (!storageConfigured) {
    return NextResponse.json(
      { ok: false, error: "مخزن الملفات غير مُهيّأ" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "صيغة الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "أرفق صورة الإيصال" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "الملف فارغ" }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "حجم الإيصال يتجاوز 5 ميجابايت" },
      { status: 413 }
    );
  }
  if (!isProofType(file.type)) {
    return NextResponse.json(
      { ok: false, error: "الصيغة غير مدعومة — استخدم JPG أو PNG أو WEBP أو PDF" },
      { status: 415 }
    );
  }

  const extension = EXT[file.type];
  const path = `${order.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  try {
    const bytes = await file.arrayBuffer();
    await uploadObject("payment-proofs", path, bytes, file.type);

    await updateOrderPayment(order.id, {
      status: "pending",
      proofPath: path,
      proofAt: new Date().toISOString(),
      reviewNote: null,
    });

    return NextResponse.json(
      { ok: true, proofPath: path },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[orders] proof upload failed", err);
    return NextResponse.json(
      { ok: false, error: "تعذّر رفع الإيصال، حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
