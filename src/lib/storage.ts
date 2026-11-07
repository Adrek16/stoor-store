const URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * تخزين الملفات في Supabase Storage عبر REST — بلا SDK.
 *
 * يُستخدم لمخزن إيصالات التحويل `payment-proofs` وهو **خاص** (public=false)،
 * فلا تُقرأ الإيصالات إلا برابط موقّع قصير الصلاحية يصدره الخادم للمدير.
 *
 * ⚠️ هذا الملف يُستورد من الخادم فقط.
 */

export const storageConfigured = Boolean(URL && KEY);

function authHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: KEY!,
    Authorization: `Bearer ${KEY}`,
    ...extra,
  };
}

/** هل الملف من الأنواع المسموحة لحجم معقول؟ */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ProofType = (typeof PROOF_TYPES)[number];

export function isProofType(value: string): value is ProofType {
  return (PROOF_TYPES as readonly string[]).includes(value);
}

/** رفع ملف إلى مخزن خاص. */
export async function uploadObject(
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  if (!URL || !KEY) throw new Error("مخزن الملفات غير مُهيّأ");

  const res = await fetch(`${URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": contentType, "x-upsert": "false" }),
    body: bytes,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`storage ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** رابط موقّع لقراءة ملف في مخزن خاص — صلاحية قصيرة. */
export async function signedObjectUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  if (!URL || !KEY) return null;

  const res = await fetch(`${URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as { signedURL?: string } | null;
  if (!body?.signedURL) return null;

  return body.signedURL.startsWith("http")
    ? body.signedURL
    : `${URL}/storage/v1${body.signedURL}`;
}
