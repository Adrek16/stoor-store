import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { STORE_INFO_TAG } from "@/lib/store-info";

/**
 * تحديث كاش المتجر من لوحة المدير المحلية.
 *
 * لوحة المدير تكتب في Supabase مباشرة (بلا المرور على هذا الخادم)،
 * فتحتاج طريقة لإبلاغ Next أن الكتالوج تغيّر. الطلب يُوقَّع بسر مشترك
 * في ترويسة `x-revalidate-secret`، ولا يُقبل أي طلب بغيره.
 *
 * إن لم يُضبط السر، يُعطَّل المسار بالكامل (503) بدل تركه مفتوحاً.
 */

function sameSecret(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.STORE_REVALIDATE_SECRET?.trim();

  const headers = { "Cache-Control": "no-store" };

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "تحديث الكاش غير مهيّأ على الخادم" },
      { status: 503, headers }
    );
  }

  const provided = request.headers.get("x-revalidate-secret") ?? "";

  if (!sameSecret(provided, expected)) {
    return NextResponse.json(
      { ok: false, error: "غير مصرّح" },
      { status: 401, headers }
    );
  }

  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidateTag(STORE_INFO_TAG, { expire: 0 });

  return NextResponse.json(
    { ok: true, tags: [CATALOG_TAG, STORE_INFO_TAG] },
    { headers }
  );
}
