/**
 * عميل Supabase REST (PostgREST) — بلا SDK.
 *
 * لماذا REST وليس اتصال Postgres مباشر؟
 *  - يعمل على الاستضافات serverless دون مشاكل مجمّع الاتصالات.
 *  - لا يحتاج كلمة مرور قاعدة البيانات، فقط مفتاح service_role.
 *  - نفس الأسلوب الذي تستخدمه Supabase في تطبيقاتها الموصى بها.
 *
 * نستخدم `node:https` بدل `fetch` العالمي لأن شبكة Supabase هنا ترفض
 * أكثر من عدد محدود من الاتصالات المتزامنة (UND_ERR_CONNECT_TIMEOUT)،
 * كما أن `fetch` داخل دوال `"use cache"` في Next كان يفشل باستمرار
 * أثناء البناء والتطوير. HTTPS المباشر + طابور تزامن + إعادة محاولة
 * للقراءات يجعل النتائج مستقرة.
 *
 * ⚠️ هذا الملف يُستورد من الخادم فقط — المفتاح سرّي ولا يجوز تسريبه للمتصفح.
 */

import http from "node:http";
import https from "node:https";

const BASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** هل ضُبطت مفاتيح Supabase؟ إن لا، يعمل المتجر على ملف/بيانات محلية. */
export const hasSupabase = Boolean(BASE_URL && KEY);

export class SupabaseError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
    this.code = code;
  }
}

/** الجدول غير موجود — يحدث قبل تنفيذ `supabase/schema.sql`. */
export const isMissingTable = (err: unknown) =>
  err instanceof SupabaseError &&
  (err.code === "PGRST205" || err.code === "42P01" || err.status === 404);

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** قيمة ترويسة Prefer، مثل return=representation أو resolution=merge-duplicates */
  prefer?: string;
};

/**
 * الحد الأقصى للطلبات المتزامنة إلى Supabase من نفس العملية.
 * الشبكة هنا تسمح بعشرة اتصالات تقريباً؛ نبقى تحت الحد بهامش آمن،
 * خصوصاً أثناء البناء حين تعمل عدة عمليات في الوقت نفسه.
 */
const MAX_CONCURRENT = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const GET_ATTEMPTS = 3;

let activeRequests = 0;
const pendingRequests: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => pendingRequests.push(resolve));
  activeRequests += 1;
}

function releaseSlot(): void {
  activeRequests -= 1;
  const next = pendingRequests.shift();
  if (next) next();
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: MAX_CONCURRENT,
  maxFreeSockets: MAX_CONCURRENT,
  timeout: REQUEST_TIMEOUT_MS,
});

type RawResponse = { status: number; text: string };

function isTransientNetworkError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

/** طلب HTTP واحد عبر node:https — لا يمرّ عبر fetch المُعدّل في Next. */
function requestOnce(
  url: URL,
  method: string,
  headers: Record<string, string>,
  payload?: string
): Promise<RawResponse> {
  const isHttps = url.protocol !== "http:";
  const lib = isHttps ? https : http;

  return new Promise<RawResponse>((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        agent: isHttps ? httpsAgent : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      const timeout = new Error("ETIMEDOUT") as Error & { code?: string };
      timeout.code = "ETIMEDOUT";
      req.destroy(timeout);
    });
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/**
 * طلب واحد إلى PostgREST.
 * @param pathname مسار نسبي داخل /rest/v1، مثل `products?select=*`
 */
export async function sb<T = Record<string, unknown>>(
  pathname: string,
  { method = "GET", body, prefer }: RequestOptions = {}
): Promise<T> {
  if (!BASE_URL || !KEY) {
    throw new SupabaseError("Supabase غير مُهيّأ — اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY", 503);
  }

  const headers: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const payload = body === undefined ? undefined : JSON.stringify(body);
  const target = new URL(`${BASE_URL}/rest/v1/${pathname}`);

  // إعادة المحاولة للقراءات فقط — إعادة POST/PATCH/DELETE قد تكرر الكتابة.
  const attempts = method === "GET" ? GET_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await acquireSlot();
    try {
      const res = await requestOnce(target, method, headers, payload);

      if (res.status < 200 || res.status >= 300) {
        let message = res.text.slice(0, 300);
        let code: string | undefined;
        try {
          const parsed = JSON.parse(res.text) as {
            message?: string;
            code?: string;
            hint?: string;
          };
          message = parsed.message ?? message;
          code = parsed.code;
        } catch {
          /* ليست JSON */
        }
        throw new SupabaseError(message, res.status, code);
      }

      return (res.text ? JSON.parse(res.text) : null) as T;
    } catch (err) {
      lastError = err;
      // أخطاء PostgREST (4xx/5xx) ليست عابرة — لا فائدة من تكرارها.
      if (err instanceof SupabaseError) throw err;
    } finally {
      releaseSlot();
    }

    if (attempt < attempts && isTransientNetworkError(lastError)) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      continue;
    }
    break;
  }

  throw lastError;
}

/** قراءة صفوف. */
export function sbSelect<T>(table: string, query = "select=*"): Promise<T[]> {
  return sb<T[]>(`${table}?${query}`);
}

/** إدراج أو تحديث صفوف (upsert على المفتاح الأساسي). */
export async function sbUpsert<T>(table: string, rows: unknown[], onConflict?: string): Promise<T[]> {
  if (!rows.length) return [];
  const conflict = onConflict ? `resolution=merge-duplicates,on_conflict=${onConflict}` : "resolution=merge-duplicates";
  return sb<T[]>(table, {
    method: "POST",
    body: rows,
    prefer: `${conflict},return=representation`,
  });
}

/** تعديل صفوف مطابقة. */
export function sbPatch<T>(table: string, filter: string, patch: unknown): Promise<T[]> {
  return sb<T[]>(`${table}?${filter}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
}

/** حذف صفوف مطابقة. */
export async function sbDelete(table: string, filter: string): Promise<void> {
  await sb(`${table}?${filter}`, { method: "DELETE", prefer: "return=minimal" });
}

/** استدعاء دالة Postgres عبر RPC. */
export function sbRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return sb<T>(`rpc/${fn}`, { method: "POST", body: args });
}

/** عدّاد سريع لصفوف جدول. */
export async function sbCount(table: string, filter = ""): Promise<number> {
  const q = `select=*${filter ? `&${filter}` : ""}`;
  const rows = await sbSelect<unknown>(table, q);
  return rows.length;
}
