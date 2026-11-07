import { hasSupabase, sbDelete, sbPatch, sbRpc, sbSelect } from "../supabase";

/**
 * سلة العميل المسجّل — طبقة الخادم الوحيدة.
 *
 * جدول `customer_carts` في Supabase، RLS مفعّل بلا سياسات عامة، والوصول
 * بمفتاح `service_role` من الخادم فقط. السلة لا تحجز مخزوناً ولا تخصم منه.
 */

export type CartLine = {
  productId: string;
  qty: number;
  option: string;
  color: string;
};

type CartRow = {
  product_id: string;
  qty: number;
  option: string | null;
  color: string | null;
};

const TABLE = "customer_carts";
const MAX_LINES = 50;

const enc = (value: string) => encodeURIComponent(value);

function lineFilter(customerId: string, line: { productId: string; option?: string; color?: string }) {
  return [
    `customer_id=eq.${enc(customerId)}`,
    `product_id=eq.${enc(line.productId)}`,
    `option=eq.${enc(line.option ?? "")}`,
    `color=eq.${enc(line.color ?? "")}`,
  ].join("&");
}

export async function readCart(customerId: string): Promise<CartLine[]> {
  if (!hasSupabase) return [];
  const rows = await sbSelect<CartRow>(
    TABLE,
    `select=product_id,qty,option,color&customer_id=eq.${enc(customerId)}&order=updated_at.asc&limit=${MAX_LINES}`
  );
  return rows.map((row) => ({
    productId: String(row.product_id),
    qty: Number(row.qty ?? 0),
    option: String(row.option ?? ""),
    color: String(row.color ?? ""),
  }));
}

/** إضافة قطعة — تزيد الكمية إن وُجد نفس المنتج/اللون/الخيار (ذرّياً في القاعدة). */
export async function addCartLine(
  customerId: string,
  line: { productId: string; qty?: number; option?: string; color?: string }
): Promise<void> {
  if (!hasSupabase) return;
  await sbRpc("cart_add", {
    p_customer_id: customerId,
    p_product_id: line.productId,
    p_option: line.option ?? "",
    p_color: line.color ?? "",
    p_qty: line.qty ?? 1,
  });
}

export async function setCartQty(
  customerId: string,
  line: { productId: string; option?: string; color?: string },
  qty: number
): Promise<void> {
  if (!hasSupabase) return;
  if (qty <= 0) {
    await removeCartLine(customerId, line);
    return;
  }
  await sbPatch(TABLE, lineFilter(customerId, line), {
    qty: Math.min(Math.floor(qty), 20),
    updated_at: new Date().toISOString(),
  });
}

export async function removeCartLine(
  customerId: string,
  line: { productId: string; option?: string; color?: string }
): Promise<void> {
  if (!hasSupabase) return;
  await sbDelete(TABLE, lineFilter(customerId, line));
}

export async function clearCart(customerId: string): Promise<void> {
  if (!hasSupabase) return;
  await sbDelete(TABLE, `customer_id=eq.${enc(customerId)}`);
}
