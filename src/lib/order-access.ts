import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

/**
 * صلاحية قراءة طلب واحد من `/api/orders/[id]`.
 *
 * المشكلة: رابط الطلب يحتوي بيانات العميل (الاسم/الجوال/العنوان)، وكانت
 * نقطة النهاية ترجعها لأي زائر يعرف المعرّف. المعرّف عشوائي 64-بت، لكن
 * الطلبات القديمة بمعرّف قصير (6 أرقام) قابلة للتعداد — والرابط نفسه قد
 * يُشارَك أو يُسرَّب.
 *
 * الحل: نمنح المتصفح الذي أنشأ الطلب كوكي موقّعاً يحمل قائمة معرّفات طلباته
 * (`stoor_orders`). القراءة تُسمح فقط لأحد ثلاثة:
 *   1. جلسة مدير.
 *   2. جلسة العميل صاحب الطلب (`customer_id = uid`).
 *   3. المتصفح الذي أنشأ الطلب (الكوكي الموقّع).
 *
 * لا تغيير على قاعدة البيانات: المعرّفات فقط، والتوقيع بـ `SESSION_SECRET`.
 */

export const ORDERS_COOKIE = "stoor_orders";

/** أقصى عدد طلبات نحفظها في الكوكي — الأحدث أولاً. */
const MAX_IDS = 20;

/** مدة الصلاحية: 180 يوماً (تغطي مراجعة العميل لطلباته القديمة). */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function signingKey(): string | null {
  return process.env.SESSION_SECRET || null;
}

function hmac(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** يفك الكوكي ويعيد قائمة المعرّفات، أو `[]` عند أي خلل. */
export function verifyOrdersCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const key = signingKey();
  if (!key) return [];

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return [];

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = hmac(payload, key);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];

  try {
    const list = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** يبني قيمة الكوكي الموقّعة من قائمة معرّفات. */
export function signOrdersCookie(ids: string[]): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify(ids), "utf8").toString("base64url");
  return `${payload}.${hmac(payload, key)}`;
}

/** يقرأ معرّفات طلبات هذا المتصفح من ترويسة الطلب. */
export function orderIdsFromRequest(request: Request): string[] {
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(/;\s*/)
    .find((part) => part.startsWith(`${ORDERS_COOKIE}=`));
  if (!match) return [];
  return verifyOrdersCookie(
    decodeURIComponent(match.slice(ORDERS_COOKIE.length + 1))
  );
}

/**
 * يسجّل الطلب في كوكي المتصفح بعد إنشائه بنجاح — فتصبح صفحة التأكيد
 * قادرة على قراءته من الخادم بعد إعادة التحميل.
 */
export function rememberOrder(
  response: NextResponse,
  request: Request,
  orderId: string
): void {
  const ids = orderIdsFromRequest(request).filter((id) => id !== orderId);
  const signed = signOrdersCookie([orderId, ...ids].slice(0, MAX_IDS));
  if (!signed) return;

  response.cookies.set(ORDERS_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
