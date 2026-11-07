import type { ArtworkKind } from "./types";

export type OrderItem = {
  name: string;
  slug: string;
  /** معرّف المنتج — لازم لتحرير المخزون عند الإلغاء */
  productId?: string;
  qty: number;
  price: number;
  option?: string;
  color?: string;
  artwork: ArtworkKind;
  tone: string;
};

export type OrderStatus = "new" | "confirmed" | "completed" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "مؤكَّد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "new",
  "confirmed",
  "completed",
  "cancelled",
];

/** حالة المبلغ — منفصلة تماماً عن حالة الطلب. */
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "غير مدفوع",
  pending: "بانتظار المراجعة",
  paid: "مدفوع",
  failed: "إيصال مرفوض",
  refunded: "مُسترجع",
};

export const PAYMENT_STATUS_ORDER: PaymentStatus[] = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
];

/**
 * طرق الدفع المدعومة.
 *
 * `card` باقية في النوع للقراءة فقط — لطلبات قديمة سُجّلت قبل إزالة البوابة،
 * ولا تُقبل في أي طلب جديد.
 */
export type PaymentMethod = "cod" | "transfer" | "wallet" | "card";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "الدفع عند الاستلام",
  transfer: "تحويل بنكي",
  wallet: "محفظة إلكترونية",
  card: "بطاقة (ملغاة)",
};

/** حالة المخزون المرتبطة بالطلب — يملكها المدير لا المتجر. */
export type StockState = "none" | "reserved" | "released";

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  none: "لم يُخصم",
  reserved: "مخصوم",
  released: "أُعيد",
};

export type Order = {
  id: string;
  createdAt: string;
  /** معرّف العميل في auth.users — يربط الطلب بحسابه في `/account` */
  customerId?: string;
  /** بريد العميل — للطلبات المرتبطة بحساب */
  customerEmail?: string;
  status?: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  /** المجموع = subtotal − discount. لا شحن ولا رسوم إضافية. */
  total: number;
  couponCode?: string;
  customer: {
    name: string;
    phone: string;
    notes?: string;
  };
  payment: PaymentMethod;
  /** معرّف الطريقة المختارة داخل settings.payment_methods (فارغ للدفع عند الاستلام) */
  paymentMethodId?: string;
  paymentStatus?: PaymentStatus;
  /** حالة خصم المخزون — يغيّرها المدير فقط عند التأكيد/الإلغاء */
  stockState?: StockState;
  /** معرّف العملية عند بوابة الدفع (طلبات قديمة بالبطاقة) */
  paymentRef?: string;
  paymentProvider?: string;
  /** مسار صورة إيصال التحويل داخل مخزن `payment-proofs` */
  paymentProofPath?: string;
  /** تاريخ رفع الإيصال */
  paymentProofAt?: string;
  /** سبب رفض الإيصال — يظهر للعميل ليصحّح */
  paymentReviewNote?: string;
  /** هل أُعيد المخزون إلى المنتجات؟ يمنع التحرير المزدوج */
  stockReleased?: boolean;
};

const ORDERS_KEY = "stoor.orders.v1";

/**
 * معرّف طلب غير قابل للتخمين.
 *
 * كان 6 أرقام عشوائية (900 ألف احتمال) — أي يمكن تعداد الطلبات وسحب
 * بيانات العملاء من `/api/orders/[id]`. الآن 64 بت من مولّد عشوائي آمن.
 */
export function newOrderId() {
  const raw = globalThis.crypto.randomUUID().replace(/-/g, "");
  return `ST-${raw.slice(0, 16).toUpperCase()}`;
}

export function saveOrder(order: Order) {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const list: Order[] = raw ? JSON.parse(raw) : [];
    const next = [order, ...list].slice(0, 30);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — order still shown from memory */
  }
}

export function getOrder(id: string): Order | null {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as Order[];
    return list.find((o) => o.id === id) ?? null;
  } catch {
    return null;
  }
}

export function getOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

