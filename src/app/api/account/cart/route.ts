import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer";
import { getCatalog } from "@/lib/catalog";
import {
  addCartLine,
  clearCart,
  readCart,
  removeCartLine,
  setCartQty,
} from "@/lib/cart/store";

/**
 * سلة العميل المسجّل — محمية بالجلسة بالكامل.
 *
 * لا سلة للزائر: كل مسار هنا يرفض 401 لغير المسجّل. الأسعار تُقرأ من
 * الكتالوج على الخادم، والكمية محدودة ١–٢٠ لكل سطر، والسلة ٥٠ سطراً.
 */

const MAX_QTY = 20;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "سجّل دخولك أولاً لإدارة سلتك" },
    { status: 401 }
  );
}

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type Incoming = {
  productId?: unknown;
  qty?: unknown;
  option?: unknown;
  color?: unknown;
};

type ValidLine = {
  ok: true;
  productId: string;
  option: string;
  color: string;
  qty: number;
};
type InvalidLine = { ok: false; error: string };

/** يتحقق أن المنتج موجود وأن اللون/الخيار صالحان فعلاً. */
async function validateLine(raw: Incoming): Promise<ValidLine | InvalidLine> {
  const productId = typeof raw.productId === "string" ? raw.productId : "";
  if (!productId) return { ok: false, error: "المنتج غير محدد" };

  const { products } = await getCatalog();
  const product = products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: "المنتج لم يعد متوفراً" };

  const option =
    typeof raw.option === "string" && product.options?.values.includes(raw.option)
      ? raw.option
      : product.options?.values[0] ?? "";

  const color =
    typeof raw.color === "string" && product.colors?.some((c) => c.name === raw.color)
      ? raw.color
      : product.colors?.[0]?.name ?? "";

  const qty = Number(raw.qty ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    return { ok: false, error: `الكمية يجب أن تكون بين ١ و${MAX_QTY}` };
  }

  return { ok: true, productId, option, color, qty };
}

export async function GET(request: Request) {
  const customer = customerFromRequest(request);
  if (!customer) return unauthorized();

  const lines = await readCart(customer.uid);
  return NextResponse.json({ ok: true, lines }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const customer = customerFromRequest(request);
  if (!customer) return unauthorized();

  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return bad("صيغة الطلب غير صحيحة");
  }

  const line = await validateLine(body);
  if (!line.ok) return bad(line.error);

  try {
    await addCartLine(customer.uid, line);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("CART_FULL")) {
      return bad("سلتك ممتلئة — أزل قطعة قبل إضافة غيرها", 409);
    }
    console.error("[cart] add failed", err);
    return bad("تعذّر تحديث السلة، حاول مرة أخرى", 500);
  }

  const lines = await readCart(customer.uid);
  return NextResponse.json({ ok: true, lines }, { status: 201 });
}

export async function PATCH(request: Request) {
  const customer = customerFromRequest(request);
  if (!customer) return unauthorized();

  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return bad("صيغة الطلب غير صحيحة");
  }

  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) return bad("المنتج غير محدد");
  const option = typeof body.option === "string" ? body.option : "";
  const color = typeof body.color === "string" ? body.color : "";

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
    return bad(`الكمية يجب أن تكون بين ١ و${MAX_QTY}`);
  }

  await setCartQty(customer.uid, { productId, option, color }, qty);
  const lines = await readCart(customer.uid);
  return NextResponse.json({ ok: true, lines }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const customer = customerFromRequest(request);
  if (!customer) return unauthorized();

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const option = url.searchParams.get("option") ?? "";
  const color = url.searchParams.get("color") ?? "";

  if (!productId) {
    await clearCart(customer.uid);
  } else {
    await removeCartLine(customer.uid, { productId, option, color });
  }

  const lines = await readCart(customer.uid);
  return NextResponse.json({ ok: true, lines }, { headers: { "Cache-Control": "no-store" } });
}
