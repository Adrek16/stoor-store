import { NextResponse } from "next/server";
import {
  CUSTOMER_COOKIE,
  customerCookieOptions,
  signCustomerSession,
  signUpCustomer,
} from "@/lib/customer";

/**
 * تسجيل عميل جديد عبر Supabase Auth بمفتاح anon.
 *
 * يُرسل البريد وكلمة المرور (والاسم الاختياري)، ويعيد جلسة موقّعة في
 * كوكي `HttpOnly` عند النجاح. الحسابات الإدارية تُرفض هنا.
 */

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; fullName?: unknown };
  try {
    body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
      fullName?: unknown;
    };
  } catch {
    return NextResponse.json(
      { ok: false, error: "صيغة الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim() || undefined;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "أدخل البريد وكلمة المرور" },
      { status: 400 }
    );
  }

  const result = await signUpCustomer({ email, password, fullName });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const signed = signCustomerSession(result.session);
  if (!signed) {
    return NextResponse.json(
      { ok: false, error: "جلسة الحساب غير مُهيّأة على الخادم" },
      { status: 503 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    user: { email: result.session.email, name: result.session.name ?? null },
  });
  res.cookies.set(CUSTOMER_COOKIE, signed, customerCookieOptions());
  return res;
}
