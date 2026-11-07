import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * طبقة مصادقة حساب العميل.
 *
 * التدفق (مطابق لوحة الإدارة، وبنفس طريقة Supabase المعتمدة):
 *  1. العميل يكتب بريده وكلمة مروره (أو يسجّل حساباً جديداً) في `/account`.
 *  2. الخادم ينادي Supabase Auth بـ**مفتاح anon** (المنشور) — لا service_role.
 *     - تسجيل الدخول: `/auth/v1/token?grant_type=password`
 *     - التسجيل:      `/auth/v1/signup`
 *  3. يُقرأ دور المستخدم من جدول `profiles` — يجب أن يكون `customer`.
 *  4. تُصدر جلسة موقّعة (HMAC-SHA256) في كوكي `HttpOnly` باسم `stoor_customer`.
 *
 * لماذا anon للعميل و service_role للإدارة؟
 *  - العميل يتعامل مع حسابه فقط؛ مفتاح anon يمنحه ذلك عبر RLS، ويمنعه
 *    من أي بيانات أخرى. هذا هو الفصل المعتمد من Supabase.
 *  - الإدارة تحتاج صلاحيات أوسع (تعديل كل الطلبات) فيُستخدم service_role
 *    على الخادم فقط.
 *
 * ⚠️ هذا الملف يُستورد من الخادم فقط — مفتاح anon لا يُرسل للمتصفح.
 */

export const CUSTOMER_COOKIE = "stoor_customer";

/** طول الجلسة قبل التجديد: 8 ساعات. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** يُجدَّد تلقائياً إذا بقي أقل من هذا على الانتهاء. */
const RENEW_WINDOW_MS = 5 * 60 * 1000;

export type CustomerSession = {
  /** معرّف المستخدم في auth.users */
  uid: string;
  email: string;
  name?: string;
  /** وقت الإصدار (ms) */
  iat: number;
  /** وقت الانتهاء (ms) */
  exp: number;
  /** رمز التجديد من Supabase — يُستخدم لتجديد الجلسة تلقائياً */
  rt?: string;
};

/* ─────────────────────────── التوقيع ─────────────────────────── */

/**
 * مفتاح التوقيع. `SESSION_SECRET` مطلوب — لا يوجد مفتاح احتياطي.
 */
function signingKey(): string | null {
  return process.env.SESSION_SECRET || null;
}

function hmac(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** يبني قيمة الكوكي: base64url(JSON) + "." + التوقيع. */
export function signCustomerSession(session: CustomerSession): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${hmac(payload, key)}`;
}

/** يفك التوقيع ويتحقق من الصلاحية. يعيد `null` عند أي خلل. */
export function verifyCustomerSession(
  raw: string | undefined | null
): CustomerSession | null {
  if (!raw) return null;
  const key = signingKey();
  if (!key) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = hmac(payload, key);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as CustomerSession;
    if (!session.uid || !session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/* ─────────────────────────── الكوكي ─────────────────────────── */

export function customerCookieOptions(maxAgeSeconds = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeSeconds),
  };
}

/** يقرأ الجلسة من ترويسة `Cookie` — للاستخدام داخل Route Handlers. */
export function customerFromRequest(request: Request): CustomerSession | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(/;\s*/)
    .find((part) => part.startsWith(`${CUSTOMER_COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(CUSTOMER_COOKIE.length + 1));
  return verifyCustomerSession(raw);
}

/** يقرأ الجلسة من كوكيز الطلب — للاستخدام داخل Server Components. */
export async function currentCustomer(): Promise<CustomerSession | null> {
  const jar = await cookies();
  return verifyCustomerSession(jar.get(CUSTOMER_COOKIE)?.value);
}

/* ─────────────────────── Supabase Auth (anon) ─────────────────────── */

function supabaseUrl(): string | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  return url || null;
}

function anonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY || null;
}

type AuthUser = { id?: string; email?: string | null; user_metadata?: { full_name?: string } };
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
  error_description?: string;
  msg?: string;
};

/**
 * يقرأ دور المستخدم من توكن Supabase (app_metadata.role).
 *
 * ⚠️ مهم: لا نستعلم `profiles` بمفتاح anon — سياسات RLS تمنع قراءة صف
 * الغير (id = auth.uid())، فيرجع فارغاً ويُفلت المدير. نقرأ الدور من
 * ادّعاءات التوكن مباشرة (موقّع من Supabase، وموثوق به كونه صادر عنها).
 */
function roleFromJwt(accessToken?: string): "admin" | "customer" | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { app_metadata?: { role?: string } };
    const role = claims.app_metadata?.role;
    if (role === "admin" || role === "customer") return role;
    return null;
  } catch {
    return null;
  }
}

/**
 * يحدّد دور المستخدم: من التوكن أولاً، وإذا تعذّر فعبر استعلام `profiles`
 * بـ**توكن المستخدم نفسه** (لا anon) حتى تحلّ RLS `auth.uid()`.
 */
async function resolveRole(
  userId: string,
  accessToken?: string
): Promise<"admin" | "customer" | null> {
  const fromJwt = roleFromJwt(accessToken);
  if (fromJwt) return fromJwt;

  if (!supabaseUrl() || !anonKey() || !accessToken) return null;
  try {
    const res = await fetch(
      `${supabaseUrl()}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(
        userId
      )}&limit=1`,
      {
        headers: {
          apikey: anonKey()!,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { role?: "admin" | "customer" }[];
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

function buildSession(
  user: AuthUser,
  refreshToken: string | undefined
): CustomerSession | null {
  if (!user.id) return null;
  const now = Date.now();
  return {
    uid: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.full_name || undefined,
    iat: now,
    exp: now + SESSION_TTL_MS,
    rt: refreshToken,
  };
}

/**
 * يسجّل عميلاً جديداً عبر Supabase Auth بمفتاح anon.
 * يُعيد جلسة موقّعة عند النجاح، أو رسالة خطأ عربية.
 */
export async function signUpCustomer(input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<{ ok: true; session: CustomerSession } | { ok: false; error: string }> {
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) {
    // بدون anon key لا يمكن إنشاء حساب عبر Supabase Auth.
    return { ok: false, error: "التسجيل غير مُهيّأ على الخادم" };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "أدخل بريداً إلكترونياً صحيحاً" };
  }
  if (password.length < 6) {
    return { ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  }

  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: input.fullName ? { full_name: input.fullName } : undefined,
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بخادم المصادقة — حاول مرة أخرى" };
  }

  const body = (await res.json().catch(() => null)) as TokenResponse | null;

  if (!res.ok || !body?.user?.id) {
    const raw = `${body?.error_description ?? ""} ${body?.msg ?? ""}`.toLowerCase();
    const taken = raw.includes("already registered") || raw.includes("already been registered");
    return {
      ok: false,
      error: taken
        ? "هذا البريد مسجّل مسبقاً — سجّل الدخول بدلاً من ذلك"
        : "تعذّر إنشاء الحساب — حاول مرة أخرى",
    };
  }

  // المشرف لا يمكنه التسجّل من هنا.
  const role = await resolveRole(body.user.id, body.access_token);
  if (role === "admin") {
    return { ok: false, error: "هذا البريد محجوز لإدارة المتجر" };
  }

  const session = buildSession(body.user, body.refresh_token);
  if (!session) {
    return { ok: false, error: "تعذّر إنشاء الجلسة — حاول مرة أخرى" };
  }
  return { ok: true, session };
}

/**
 * يحاول تسجيل الدخول بالبريد وكلمة المرور (مفتاح anon).
 * يرفض الحسابات الإدارية — إدارة المتجر تطبيق محلي منفصل، لا تدخل من هنا.
 */
export async function signInCustomer(
  email: string,
  password: string
): Promise<{ ok: true; session: CustomerSession } | { ok: false; error: string }> {
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) {
    return { ok: false, error: "تسجيل الدخول غير مُهيّأ على الخادم" };
  }
  if (!email || !password) {
    return { ok: false, error: "أدخل البريد وكلمة المرور" };
  }

  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بخادم المصادقة — حاول مرة أخرى" };
  }

  const body = (await res.json().catch(() => null)) as TokenResponse | null;

  if (!res.ok || !body?.user?.id) {
    const raw = `${body?.error_description ?? ""} ${body?.msg ?? ""}`.toLowerCase();
    const invalid = raw.includes("invalid login credentials");
    const disabled = raw.includes("email not confirmed") || raw.includes("not confirmed");
    return {
      ok: false,
      error: invalid
        ? "البريد أو كلمة المرور غير صحيحة"
        : disabled
          ? "الحساب غير مُفعّل — راجع بريدك لتأكيد الحساب"
          : "تعذّر تسجيل الدخول — حاول مرة أخرى",
    };
  }

  const role = await resolveRole(body.user.id, body.access_token);
  if (role === "admin") {
    // حساب إداري — يُرسَل إلى شاشة الدخول الإدارية.
    return { ok: false, error: "هذا الحساب للإدارة — سجّل الدخول من صفحة المدير" };
  }

  const session = buildSession(body.user, body.refresh_token);
  if (!session) {
    return { ok: false, error: "تعذّر إنشاء الجلسة — حاول مرة أخرى" };
  }
  return { ok: true, session };
}

/** يجدّد الجلسة قبل انتهائها باستخدام refresh token (مفتاح anon). */
export async function renewCustomerSession(
  session: CustomerSession
): Promise<CustomerSession | null> {
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key || !session.rt) return null;

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.rt }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json().catch(() => null)) as TokenResponse | null;
    if (!body?.user?.id || body.user.id !== session.uid) return null;

    const now = Date.now();
    return {
      ...session,
      name: body.user.user_metadata?.full_name || session.name,
      email: body.user.email ?? session.email,
      iat: now,
      exp: now + SESSION_TTL_MS,
      rt: body.refresh_token ?? session.rt,
    };
  } catch {
    return null;
  }
}

/** هل تحتاج الجلسة تجديداً الآن؟ */
export function needsRenewal(session: CustomerSession): boolean {
  return session.exp - Date.now() <= RENEW_WINDOW_MS;
}

/* ─────────────────────── حماية الصفحات ─────────────────────── */

/**
 * تحمي صفحة حساب العميل على مستوى الخادم.
 * تعيد توجيه إلى `/account` (فيه نموذج دخول العميل) إن لم توجد جلسة.
 */
export async function requireCustomer(nextPath = "/account"): Promise<CustomerSession> {
  const session = await currentCustomer();
  if (!session) {
    redirect(`/account?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}
