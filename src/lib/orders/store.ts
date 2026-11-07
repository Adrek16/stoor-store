import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, OrderStatus, PaymentStatus, StockState } from "../orders";
import { hasSupabase, sb, sbRpc } from "../supabase";

/**
 * طبقة تخزين الطلبات.
 *
 * سائقان (drivers):
 *   1. Supabase REST — يُستخدم تلقائياً عند وجود SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   2. ملف JSONL محلي — احتياطي للتطوير بلا خدمات خارجية.
 *
 * الواجهة ثابتة، فباقي الكود (API، الواجهة) لا يعرف أي سائق يعمل.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "orders.jsonl");

export const storeDriver: "supabase" | "file" = hasSupabase ? "supabase" : "file";

type Row = Record<string, unknown>;

function toRow(o: Order): Row {
  return {
    id: o.id,
    created_at: o.createdAt,
    customer_id: o.customerId ?? null,
    customer_email: o.customerEmail ?? null,
    status: o.status ?? "new",
    customer_name: o.customer.name,
    customer_phone: o.customer.phone,
    notes: o.customer.notes ?? null,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    coupon_code: o.couponCode ?? null,
    payment: o.payment,
    payment_method_id: o.paymentMethodId ?? null,
    payment_status: o.paymentStatus ?? "unpaid",
    payment_ref: o.paymentRef ?? null,
    payment_provider: o.paymentProvider ?? null,
    payment_proof_path: o.paymentProofPath ?? null,
    payment_proof_at: o.paymentProofAt ?? null,
    payment_review_note: o.paymentReviewNote ?? null,
    stock_state: o.stockState ?? "none",
    stock_released: o.stockReleased ?? false,
    items: o.items,
  };
}

/**
 * حالة الطلب كما تُقرأ من القاعدة.
 *
 * `shipped`/`delivered` لم تعُد موجودة في القيد، لكن صفوفاً قديمة قد تحملها
 * (أو بيانات محلية سابقة) — تُطبَّع إلى `confirmed` بدل إظهار حالة غريبة.
 */
function toStatus(value: unknown): OrderStatus {
  const raw = String(value ?? "");
  if (raw === "shipped" || raw === "delivered") return "confirmed";
  if (raw === "confirmed" || raw === "completed" || raw === "cancelled") {
    return raw as OrderStatus;
  }
  return "new";
}

function toPayment(value: unknown): Order["payment"] {
  const raw = String(value ?? "");
  if (raw === "transfer" || raw === "wallet" || raw === "card") {
    return raw as Order["payment"];
  }
  return "cod";
}

function toStockState(value: unknown): StockState {
  const raw = String(value ?? "");
  if (raw === "reserved" || raw === "released") return raw as StockState;
  return "none";
}

function fromRow(r: Row): Order {
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    customerId: r.customer_id ? String(r.customer_id) : undefined,
    customerEmail: r.customer_email ? String(r.customer_email) : undefined,
    status: toStatus(r.status),
    items: (r.items as Order["items"]) ?? [],
    subtotal: Number(r.subtotal ?? 0),
    discount: Number(r.discount ?? 0),
    total: Number(r.total ?? 0),
    couponCode: r.coupon_code ? String(r.coupon_code) : undefined,
    customer: {
      name: String(r.customer_name ?? ""),
      phone: String(r.customer_phone ?? ""),
      notes: r.notes ? String(r.notes) : undefined,
    },
    payment: toPayment(r.payment),
    paymentMethodId: r.payment_method_id ? String(r.payment_method_id) : undefined,
    paymentStatus: (r.payment_status as PaymentStatus) ?? "unpaid",
    paymentRef: r.payment_ref ? String(r.payment_ref) : undefined,
    paymentProvider: r.payment_provider ? String(r.payment_provider) : undefined,
    paymentProofPath: r.payment_proof_path ? String(r.payment_proof_path) : undefined,
    paymentProofAt: r.payment_proof_at ? String(r.payment_proof_at) : undefined,
    paymentReviewNote: r.payment_review_note ? String(r.payment_review_note) : undefined,
    stockState: toStockState(r.stock_state),
    stockReleased: Boolean(r.stock_released),
  };
}

/* ─────────────────────────── الملف ─────────────────────────── */

async function readFileOrders(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Order)
      .reverse();
  } catch {
    return [];
  }
}

async function writeFileOrders(orders: Order[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  const body = [...orders]
    .reverse()
    .map((o) => JSON.stringify(o))
    .join("\n");
  await fs.writeFile(tmp, body ? `${body}\n` : "", "utf8");
  await fs.rename(tmp, FILE);
}

/* ─────────────────────────── الواجهة ─────────────────────────── */

export async function persistOrder(order: Order): Promise<void> {
  if (storeDriver === "supabase") {
    await sb("orders", {
      method: "POST",
      body: toRow(order),
      prefer: "return=minimal",
    });
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(FILE, `${JSON.stringify(order)}\n`, "utf8");
}

export async function readOrders(): Promise<Order[]> {
  if (storeDriver === "supabase") {
    const rows = await sb<Row[]>("orders?select=*&order=created_at.desc&limit=200");
    return rows.map(fromRow);
  }
  return readFileOrders();
}

/** طلبات عميل واحد — يستخدمها `/account` لعرض «طلباتي». */
export async function readOrdersByCustomer(customerId: string): Promise<Order[]> {
  if (storeDriver === "supabase") {
    const rows = await sb<Row[]>(
      `orders?select=*&customer_id=eq.${encodeURIComponent(customerId)}&order=created_at.desc&limit=200`
    );
    return rows.map(fromRow);
  }
  const orders = await readFileOrders();
  return orders.filter((o) => o.customerId === customerId);
}

/** طلب واحد بالمعرّف — تستخدمه بوابة الدفع للتحقق من المبلغ. */
export async function readOrder(id: string): Promise<Order | null> {
  if (storeDriver === "supabase") {
    const rows = await sb<Row[]>(`orders?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows.length ? fromRow(rows[0]) : null;
  }
  const orders = await readFileOrders();
  return orders.find((o) => o.id === id) ?? null;
}

/** تحديث بيانات الدفع على الطلب (الحالة، الإيصال، ملاحظة المراجعة). */
export async function updateOrderPayment(
  id: string,
  patch: {
    status?: PaymentStatus;
    ref?: string | null;
    provider?: string | null;
    proofPath?: string | null;
    proofAt?: string | null;
    reviewNote?: string | null;
  }
): Promise<boolean> {
  if (storeDriver === "supabase") {
    const body: Row = {};
    if (patch.status !== undefined) body.payment_status = patch.status;
    if (patch.ref !== undefined) body.payment_ref = patch.ref;
    if (patch.provider !== undefined) body.payment_provider = patch.provider;
    if (patch.proofPath !== undefined) body.payment_proof_path = patch.proofPath;
    if (patch.proofAt !== undefined) body.payment_proof_at = patch.proofAt;
    if (patch.reviewNote !== undefined) body.payment_review_note = patch.reviewNote;
    if (Object.keys(body).length === 0) return true;

    const rows = await sb<Row[]>(`orders?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
      prefer: "return=representation",
    });
    return rows.length > 0;
  }

  const orders = await readFileOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return false;
  if (patch.status !== undefined) target.paymentStatus = patch.status;
  if (patch.ref !== undefined) target.paymentRef = patch.ref ?? undefined;
  if (patch.provider !== undefined) target.paymentProvider = patch.provider ?? undefined;
  if (patch.proofPath !== undefined) target.paymentProofPath = patch.proofPath ?? undefined;
  if (patch.proofAt !== undefined) target.paymentProofAt = patch.proofAt ?? undefined;
  if (patch.reviewNote !== undefined) target.paymentReviewNote = patch.reviewNote ?? undefined;
  await writeFileOrders(orders);
  return true;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<boolean> {
  if (storeDriver === "supabase") {
    const rows = await sb<Row[]>(`orders?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
      prefer: "return=representation",
    });
    return rows.length > 0;
  }

  const orders = await readFileOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return false;
  target.status = status;
  await writeFileOrders(orders);
  return true;
}

/**
 * إعادة مخزون الطلب إلى المنتجات — مرة واحدة فقط.
 *
 * في Supabase تتحقق الدالة `release_order_stock` من عمود `stock_released`
 * وتحرّر الكميات في معاملة واحدة، فلا يمكن تحرير المخزون مرتين لو تكرّر
 * الإلغاء أو وصل أكثر من طلب متزامن.
 */
export async function releaseOrderStock(id: string): Promise<boolean> {
  if (storeDriver === "supabase") {
    const released = await sbRpc<boolean>("release_order_stock", { p_order_id: id });
    return released === true;
  }

  const orders = await readFileOrders();
  const target = orders.find((o) => o.id === id);
  if (!target || target.stockReleased) return false;
  target.stockReleased = true;
  await writeFileOrders(orders);
  return true;
}

/**
 * إعادة حجز مخزون طلب أُلغي ثم أُعيد فتحه.
 *
 * في Supabase تخصم الدالة `reserve_order_stock` الكميات ذرّياً وترفع
 * `OUT_OF_STOCK:<id>` إن لم تكفِ الكمية، فتبقى الطلب ملغياً كما هو.
 * تعيد `false` إن لم يكن هناك ما يُحجز (مخزونه ما زال محجوزاً).
 */
export async function reserveOrderStock(id: string): Promise<boolean> {
  if (storeDriver === "supabase") {
    const reserved = await sbRpc<boolean>("reserve_order_stock", { p_order_id: id });
    return reserved === true;
  }

  const orders = await readFileOrders();
  const target = orders.find((o) => o.id === id);
  if (!target || !target.stockReleased) return false;
  target.stockReleased = false;
  await writeFileOrders(orders);
  return true;
}
