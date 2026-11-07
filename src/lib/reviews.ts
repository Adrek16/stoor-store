import { sb, sbSelect, SupabaseError } from "./supabase";

/**
 * تقييمات العملاء في المتجر.
 *
 * المصدر الوحيد: جدول `product_reviews` (RLS مفعّل، والوصول عبر الخادم
 * بمفتاح service_role فقط). لا يظهر أي تقييم قبل اعتماد المدير.
 *
 * التحقق من «مشترٍ موثّق»: وجود طلب للمستخدم بحالة مؤكدة/مكتملة يحتوي
 * المنتج في قطعه. نقبل `productId` أو `slug` لأن الطلبات القديمة قد تخلو
 * من المعرّف.
 */

const SALES_STATUSES = ["confirmed", "completed"] as const;
const MAX_REVIEWS = 50;
const MAX_COMMENT = 800;

export type ReviewStatus = "pending" | "approved" | "rejected";

type ReviewRow = {
  id: string;
  product_id: string;
  customer_id: string;
  order_id: string | null;
  rating: number;
  comment: string;
  status: ReviewStatus;
  manager_reply: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type OrderRow = {
  id: string;
  items: unknown;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  managerReply: string | null;
  createdAt: string;
  customerName: string;
};

export type HomeReview = PublicReview & {
  productName: string;
  productSlug: string;
};

export type ReviewEligibility =
  | { canReview: true; orderId: string }
  | {
      canReview: false;
      reason: "login" | "not-bought" | "already-reviewed";
      existingStatus?: ReviewStatus;
    };

/** اسم عرض مختصر: الاسم الأول فقط — لا نكشف الاسم الكامل أو البريد. */
function displayName(fullName: string | null | undefined): string {
  const name = String(fullName ?? "").trim();
  if (!name) return "عميل";
  const first = name.split(/\s+/)[0];
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function orderItems(row: OrderRow): Record<string, unknown>[] {
  if (!Array.isArray(row.items)) return [];
  return row.items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function orderHasProduct(row: OrderRow, product: { id: string; slug: string }): boolean {
  return orderItems(row).some(
    (item) =>
      (typeof item.productId === "string" && item.productId === product.id) ||
      (typeof item.slug === "string" && item.slug === product.slug)
  );
}

/** التقييمات المعتمدة فقط — للعرض العلني. */
export async function getApprovedReviews(productId: string): Promise<PublicReview[]> {
  const rows = await sbSelect<ReviewRow>(
    "product_reviews",
    `select=id,product_id,customer_id,order_id,rating,comment,status,manager_reply,created_at` +
      `&product_id=eq.${encodeURIComponent(productId)}&status=eq.approved` +
      `&order=created_at.desc&limit=${MAX_REVIEWS}`
  );

  if (!rows.length) return [];

  const ids = Array.from(new Set(rows.map((row) => row.customer_id).filter(Boolean)));
  let profiles: ProfileRow[] = [];
  if (ids.length) {
    const filter = ids.map((id) => encodeURIComponent(id)).join(",");
    profiles = await sbSelect<ProfileRow>(
      "profiles",
      `select=id,full_name&id=in.(${filter})&limit=${ids.length}`
    );
  }
  const names = new Map(profiles.map((profile) => [profile.id, profile.full_name]));

  return rows.map((row) => ({
    id: String(row.id),
    rating: Math.max(1, Math.min(5, Number(row.rating) || 0)),
    comment: String(row.comment ?? "").trim(),
    managerReply: row.manager_reply ? String(row.manager_reply).trim() : null,
    createdAt: String(row.created_at ?? ""),
    customerName: displayName(names.get(row.customer_id)),
  }));
}

/** أحدث التقييمات المعتمدة عبر كل المنتجات — لقسم «آراء العملاء» في الرئيسية. */
export async function getLatestApprovedReviews(limit = 6): Promise<HomeReview[]> {
  const safeLimit = Math.max(1, Math.min(12, Math.trunc(limit) || 6));

  const rows = await sbSelect<ReviewRow>(
    "product_reviews",
    `select=id,product_id,customer_id,rating,comment,status,manager_reply,created_at` +
      `&status=eq.approved&order=created_at.desc&limit=${safeLimit}`
  );

  if (!rows.length) return [];

  const productIds = Array.from(new Set(rows.map((row) => row.product_id).filter(Boolean)));
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter(Boolean)));

  const [products, profiles] = await Promise.all([
    productIds.length
      ? sbSelect<{ id: string; name: string; slug: string }>(
          "products",
          `select=id,name,slug&id=in.(${productIds
            .map((id) => encodeURIComponent(id))
            .join(",")})&active=eq.true&limit=${productIds.length}`
        )
      : Promise.resolve([]),
    customerIds.length
      ? sbSelect<ProfileRow>(
          "profiles",
          `select=id,full_name&id=in.(${customerIds
            .map((id) => encodeURIComponent(id))
            .join(",")})&limit=${customerIds.length}`
        )
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const nameMap = new Map(profiles.map((profile) => [profile.id, profile.full_name]));

  return rows.flatMap((row) => {
    const product = productMap.get(row.product_id);
    if (!product) return [];
    return [
      {
        id: String(row.id),
        rating: Math.max(1, Math.min(5, Number(row.rating) || 0)),
        comment: String(row.comment ?? "").trim(),
        managerReply: row.manager_reply ? String(row.manager_reply).trim() : null,
        createdAt: String(row.created_at ?? ""),
        customerName: displayName(nameMap.get(row.customer_id)),
        productName: String(product.name ?? ""),
        productSlug: String(product.slug ?? ""),
      },
    ];
  });
}

/** هل يحق لهذا العميل تقييم المنتج الآن؟ */
export async function getReviewEligibility(
  customerId: string,
  product: { id: string; slug: string }
): Promise<ReviewEligibility> {
  if (!customerId) return { canReview: false, reason: "login" };

  const existing = await sbSelect<{ id: string; status: ReviewStatus }>(
    "product_reviews",
    `select=id,status&product_id=eq.${encodeURIComponent(product.id)}` +
      `&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`
  );

  if (existing.length) {
    return {
      canReview: false,
      reason: "already-reviewed",
      existingStatus: existing[0].status,
    };
  }

  const orders = await sbSelect<OrderRow>(
    "orders",
    `select=id,items&customer_id=eq.${encodeURIComponent(customerId)}` +
      `&status=in.(${SALES_STATUSES.join(",")})&order=created_at.desc&limit=200`
  );

  const match = orders.find((order) => orderHasProduct(order, product));
  if (!match) return { canReview: false, reason: "not-bought" };

  return { canReview: true, orderId: String(match.id) };
}

export type CreateReviewResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** إرسال تقييم جديد — يبقى `pending` حتى يعتمده المدير. */
export async function createReview(input: {
  productId: string;
  customerId: string;
  rating: unknown;
  comment: unknown;
}): Promise<CreateReviewResult> {
  const productId = String(input.productId ?? "").trim();
  const customerId = String(input.customerId ?? "").trim();
  if (!productId || !customerId) {
    return { ok: false, status: 400, error: "الطلب غير مكتمل" };
  }

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, status: 400, error: "اختر تقييماً من نجمة إلى خمس نجوم" };
  }

  const comment = String(input.comment ?? "").trim().slice(0, MAX_COMMENT);

  const products = await sbSelect<{ id: string; slug: string; active: boolean }>(
    "products",
    `select=id,slug,active&id=eq.${encodeURIComponent(productId)}&limit=1`
  );
  const product = products[0];
  if (!product || product.active === false) {
    return { ok: false, status: 404, error: "المنتج غير موجود" };
  }

  const eligibility = await getReviewEligibility(customerId, {
    id: String(product.id),
    slug: String(product.slug),
  });
  if (!eligibility.canReview) {
    if (eligibility.reason === "already-reviewed") {
      return { ok: false, status: 409, error: "أرسلت تقييماً لهذا المنتج مسبقاً" };
    }
    return {
      ok: false,
      status: 403,
      error: "التقييم متاح فقط لمن اشترى المنتج في طلب مؤكد",
    };
  }

  try {
    await sb("product_reviews", {
      method: "POST",
      body: {
        product_id: productId,
        customer_id: customerId,
        order_id: eligibility.orderId,
        rating,
        comment,
        status: "pending",
      },
      prefer: "return=minimal",
    });
    return { ok: true };
  } catch (error) {
    if (
      error instanceof SupabaseError &&
      (error.code === "23505" || error.status === 409)
    ) {
      return { ok: false, status: 409, error: "أرسلت تقييماً لهذا المنتج مسبقاً" };
    }
    console.error("[reviews] create failed", error);
    return { ok: false, status: 500, error: "تعذّر إرسال التقييم — حاول مرة أخرى" };
  }
}
