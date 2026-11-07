import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { newOrderId, type Order } from "@/lib/orders";
import { persistOrder } from "@/lib/orders/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { customerFromRequest } from "@/lib/customer";
import { rememberOrder } from "@/lib/order-access";
import { resolvePaymentMethod } from "@/lib/settings";
import { hasSupabase } from "@/lib/supabase";

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

type IncomingItem = {
  productId?: unknown;
  qty?: unknown;
  option?: unknown;
  color?: unknown;
};

type Payload = {
  items?: unknown;
  customer?: unknown;
  payment?: unknown;
  paymentMethodId?: unknown;
};

const PHONE_RE = /^(7\d{8}|\+9677\d{8})$/;
const MAX_QTY = 20;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * الطلب يُعاد حسابه بالكامل من الخادم:
 * الأسعار والخصم لا تُؤخذ من العميل إطلاقاً.
 * هذا يمنع التلاعب بالسعر عبر تعديل الـ payload.
 */
export async function POST(request: Request) {
  // حدّ بسيط ضد إغراق المتجر بطلبات وهمية (8 طلبات كل 10 دقائق لكل IP).
  const limited = rateLimit(`orders:create:${clientIp(request)}`, 8, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "عدد المحاولات كبير — انتظر قليلاً ثم أعد المحاولة" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return bad("صيغة الطلب غير صحيحة");
  }
  if (!body || typeof body !== "object") return bad("صيغة الطلب غير صحيحة");

  /* ── القطع + إعادة التسعير ─────────────────────────── */
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad("السلة فارغة");
  }
  if (body.items.length > 50) {
    return bad("عدد القطع كبير جداً");
  }

  const items: Order["items"] = [];
  let subtotal = 0;

  // الأسعار تُقرأ من مصدر الخادم (قاعدة البيانات أو البيانات المحلية) لا من العميل.
  const { products } = await getCatalog();

  for (const raw of body.items as IncomingItem[]) {
    const product = products.find((p) => p.id === raw.productId);
    if (!product) return bad("أحد المنتجات لم يعد متوفراً");

    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return bad(`كمية غير صحيحة للمنتج ${product.name}`);
    }

    const option =
      typeof raw.option === "string" &&
      product.options?.values.includes(raw.option)
        ? raw.option
        : product.options?.values[0];

    const color =
      typeof raw.color === "string" && product.colors?.some((c) => c.name === raw.color)
        ? raw.color
        : product.colors?.[0]?.name;

    // لا حجز ولا خصم مخزون عند إنشاء الطلب: الخصم يحدث عند تأكيد المدير
    // عبر confirm_order_stock، فالسلة والطلب لا يمسّان المخزون إطلاقاً.
    // في وضع الملف المحلي (بلا Supabase) نتحقق فقط من توفّر الكمية للعرض.
    if (!hasSupabase) {
      const selected = color
        ? product.colors?.find((c) => c.name === color)
        : undefined;
      const colorStock = typeof selected?.stock === "number" ? selected.stock : null;

      if (colorStock !== null) {
        if (colorStock <= 0) {
          return bad(`${product.name} — ${color} غير متوفر حالياً`);
        }
        if (qty > colorStock) {
          return bad(`المتوفر من ${product.name} بلون ${color} هو ${colorStock} قطعة فقط`);
        }
      } else {
        if (product.stock <= 0) {
          return bad(`${product.name} غير متوفر حالياً`);
        }
        if (qty > product.stock) {
          return bad(`المتوفر من ${product.name} هو ${product.stock} قطعة فقط`);
        }
      }
    }

    // لا حجز ولا خصم مخزون عند إنشاء الطلب: الخصم يحدث عند تأكيد المدير
    // عبر confirm_order_stock، فالسلة والطلب لا يمسّان المخزون إطلاقاً.
    // في وضع الملف المحلي (بلا Supabase) نتحقق فقط من توفّر الكمية للعرض.

    // لا حجز ولا خصم مخزون عند إنشاء الطلب: الخصم يحدث عند تأكيد المدير
    // عبر confirm_order_stock، فالسلة والطلب لا يمسّان المخزون إطلاقاً.
    // في وضع الملف المحلي (بلا Supabase) نتحقق فقط من توفّر الكمية للعرض.

    subtotal += product.price * qty;

    items.push({
      name: product.name,
      slug: product.slug,
      productId: product.id,
      qty,
      price: product.price,
      option,
      color,
      artwork: product.artwork,
      tone: product.tone,
    });
  }

  /* ── بيانات المستلم ────────────────────────────────── */
  const c = (body.customer ?? {}) as Record<string, unknown>;
  const name = String(c.name ?? "").trim();
  const phone = String(c.phone ?? "").replace(/\s/g, "");
  const notes = String(c.notes ?? "").trim().slice(0, 500);

  // نربط الطلب بحساب العميل إن كان مسجّلاً الدخول (كوكي HttpOnly يُرسله
  // المتصفح تلقائياً). هكذا يظهر الطلب في «طلباتي» داخل /account.
  const customer = customerFromRequest(request);

  if (name.length < 3) return bad("الاسم غير مكتمل");
  if (!PHONE_RE.test(phone)) return bad("رقم الجوال غير صحيح");

  /* ── الدفع ─────────────────────────────────────────── */
  // ثلاث طرق: عند الاستلام، تحويل بنكي، أو محفظة محلية (بإيصال يراجعه المدير).
  // الدفع بالبطاقة أُزيل نهائياً — لا بوابة ولا حالة "بانتظار الدفع" خارجية.
  const allowedPayments = new Set(["cod", "transfer", "wallet"]);
  const rawPayment = typeof body.payment === "string" ? body.payment : "cod";
  const payment = (allowedPayments.has(rawPayment) ? rawPayment : "cod") as Order["payment"];
  const paymentMethodId =
    typeof body.paymentMethodId === "string" ? body.paymentMethodId.trim().slice(0, 60) : "";

  // لا نقبل تحويلاً/محفظة بلا طريقة مفعّلة محددة — وإلا لن يعرف العميل
  // إلى أين يحوّل، وستبقى الطلبات معلّقة حتى الإلغاء التلقائي.
  if (payment === "transfer" || payment === "wallet") {
    const method = await resolvePaymentMethod(
      paymentMethodId,
      payment === "transfer" ? "bank" : "wallet"
    );
    if (!method) {
      return bad(
        payment === "transfer"
          ? "التحويل البنكي غير متاح حالياً — اختر الدفع عند الاستلام"
          : "المحفظة المختارة غير متاحة حالياً — اختر طريقة أخرى"
      );
    }
  }

  /* ── الإجمالي ──────────────────────────────────────── */
  // لا كوبونات: الخصم دائماً صفر (العمود باقٍ لقراءة الطلبات القديمة).
  const discount = 0;
  const total = Math.max(0, subtotal - discount);

  /* ── الحفظ ─────────────────────────────────────────── */
  // كل طلب مرتبط بحساب عميل — لا طلبات مجهولة (السلة نفسها تتطلب الدخول).
  if (!customer) {
    return bad("سجّل دخولك أولاً لإتمام الطلب", 401);
  }

  const order: Order = {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    customerId: customer.uid,
    customerEmail: customer.email,
    items,
    subtotal,
    discount,
    total,
    customer: { name, phone, notes: notes || undefined },
    payment,
    paymentMethodId: paymentMethodId || undefined,
    // التحويل/المحفظة يبدآن "بانتظار المراجعة" حتى يرفع العميل الإيصال ويعتمده المدير.
    paymentStatus: payment === "cod" ? "unpaid" : "pending",
  };

  try {
    await persistOrder(order);
  } catch (err) {
    console.error("[orders] failed to persist", err);
    return bad("تعذّر حفظ الطلب، حاول مرة أخرى", 500);
  }

  // لا مخزون تغيّر عند الإنشاء — لا حاجة لإبطال كاش الكتالوج.

  // نمنح هذا المتصفح صلاحية قراءة طلبه لاحقاً (صفحة التأكيد / الدفع)
  // دون فتح بيانات العملاء لأي زائر يعرف المعرّف.
  const response = NextResponse.json({ ok: true, order }, { status: 201 });
  rememberOrder(response, request, order.id);
  return response;
}
