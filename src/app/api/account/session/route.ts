import { NextResponse } from "next/server";
import {
  CUSTOMER_COOKIE,
  customerCookieOptions,
  customerFromRequest,
  needsRenewal,
  renewCustomerSession,
  signCustomerSession,
  signInCustomer,
} from "@/lib/customer";

/**
 * جلسة حساب العميل.
 *
 *  POST   → تسجيل الدخول (بريد + كلمة مرور) عبر Supabase Auth بمفتاح anon.
 *  GET    → هل الجلسة قائمة؟ (تستخدمه الواجهة عند الفتح).
 *  DELETE → خروج (مسح الكوكي).
 */

// ملاحظة: لا تستخدم `export const runtime` هنا — غير متوافق مع cacheComponents في Next 16.

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "صيغة الطلب غير صحيحة" },
      { status: 400 }
    );
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "أدخل البريد وكلمة المرور" },
      { status: 400 }
    );
  }

  const result = await signInCustomer(email, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  const signed = signCustomerSession(result.session);
  if (!signed) {
    return NextResponse.json(
      { ok: false, error: "جلسة الدخول غير مُهيّأة على الخادم" },
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

export async function GET(request: Request) {
  let session = customerFromRequest(request);

  if (!session) {
    return NextResponse.json({ ok: false, error: "لا توجد جلسة" }, { status: 401 });
  }

  // تجديد تلقائي قبل انتهاء الجلسة.
  if (needsRenewal(session)) {
    const renewed = await renewCustomerSession(session);
    if (renewed) {
      session = renewed;
      const signed = signCustomerSession(renewed);
      if (signed) {
        const res = NextResponse.json({
          ok: true,
          user: { email: renewed.email, name: renewed.name ?? null },
        });
        res.cookies.set(CUSTOMER_COOKIE, signed, customerCookieOptions());
        return res;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    user: { email: session.email, name: session.name ?? null },
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { ...customerCookieOptions(), maxAge: 0 });
  return res;
}
