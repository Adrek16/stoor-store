/**
 * حدّ معدّل بسيط في الذاكرة (نافذة زمنية ثابتة).
 *
 * ⚠️ لكل نسخة من الخادم ذاكرتها الخاصة. على Vercel قد توجد عدة نسخ،
 * لذا هذا الدرع يقلّل الإساءة ولا يمنعها تماماً. للحماية الكاملة استخدم
 * Upstash Redis أو Vercel Firewall لاحقاً.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** سقف عدد المفاتيح منعاً لنمو الذاكرة بلا حد. */
const MAX_KEYS = 5_000;

export type RateLimitResult =
  | { ok: true; remaining: number; retryAfter: 0 }
  | { ok: false; remaining: 0; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/** عنوان العميل من ترويسات الوسيط (Vercel/Cloudflare) أو محلياً. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}
