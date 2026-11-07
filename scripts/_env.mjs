/**
 * أدوات مشتركة لسكربتات قاعدة البيانات.
 *
 * - loadEnvLocal: يقرأ `.env.local` دون استبدال متغيرات البيئة الموجودة.
 * - rest: طلب واحد إلى PostgREST مع رسائل خطأ واضحة (.status/.code).
 * - makeClient / requireDatabaseUrl: اتصال Postgres المباشر (اختياري).
 * - redact: إخفاء الأسرار قبل الطباعة.
 */
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");

/** تحميل `.env.local` في process.env (القيم الموجودة مسبقاً لها الأولوية). */
export function loadEnvLocal() {
  let raw;
  try {
    raw = fs.readFileSync(ENV_FILE, "utf8");
  } catch {
    return;
  }

  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) process.env[key] = value;
  }
}

/** إخفاء كلمات المرور والرموز قبل طباعتها. */
export function redact(value) {
  return String(value)
    .replace(/([?&](?:password|apikey|key|token)=)[^&]*/gi, "$1***")
    .replace(/:\/\/([^:@/]+):[^@/]+@/, "://$1:***@")
    .replace(/\b(sbp_|eyJ)[A-Za-z0-9._-]+/g, "$1***");
}

/** قراءة إعدادات Supabase المطلوبة أو رمي خطأ واضح. */
export function requireSupabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY غير مضبوطين — ضعهما في .env.local"
    );
  }

  return { url, key };
}

/**
 * طلب إلى PostgREST.
 * @param {string} url عنوان المشروع (بلا / في النهاية)
 * @param {string} key مفتاح service_role
 * @param {string} pathname مسار نسبي داخل /rest/v1 (مثل `products?select=*`)
 * @param {{method?: string, headers?: Record<string, string>, body?: string}} [options]
 */
export async function rest(url, key, pathname, options = {}) {
  const { method = "GET", headers = {}, body } = options;

  const res = await fetch(`${url}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    let message = text.slice(0, 400);
    let code;

    try {
      const parsed = JSON.parse(text);
      message = parsed.message ?? message;
      code = parsed.code;
    } catch {
      /* ليست JSON */
    }

    const err = new Error(message);
    err.status = res.status;
    err.code = code;
    throw err;
  }

  return text ? JSON.parse(text) : null;
}

/** رابط Postgres المباشر (اختياري). */
export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير مضبوط في .env.local");
  return url;
}

/** عميل pg مهيّأ للاتصال المباشر. */
export function makeClient(pg, url) {
  return new pg.Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 12_000,
  });
}
