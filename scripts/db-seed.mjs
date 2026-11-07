/**
 * يزرع التصنيفات والمنتجات التجريبية في Supabase عبر REST (بلا كلمة مرور قاعدة بيانات).
 * المصدر: src/lib/categories.ts و src/lib/products.ts — نفس بيانات الواجهة.
 *
 * الاستخدام:
 *   npm run db:seed         إدراج الصفوف الناقصة فقط — لا يمسّ الصفوف الموجودة
 *   npm run db:seed:force   استبدال الصفوف الموجودة ببيانات المشروع الأصلية
 *
 * سبب التغيير: الوضع القديم كان يستبدل كل صف في كل تشغيل، فيعيد المخزون
 * والأسعار والتعديلات الإدارية إلى قيمها الأصلية ويغيّر `updated_at`
 * في كل مرة. الآن التشغيل العادي آمن تماماً.
 */
import { loadEnvLocal, requireSupabase, rest } from "./_env.mjs";
import { categories } from "../src/lib/categories.ts";
import { products } from "../src/lib/products.ts";

loadEnvLocal();
const { url, key } = requireSupabase();

/** استبدال الصفوف الموجودة؟ يُفعَّل بـ --force فقط. */
const FORCE = process.argv.includes("--force");

const upsert = (table, rows) =>
  rest(url, key, table, {
    method: "POST",
    headers: {
      // ignore-duplicates = ON CONFLICT DO NOTHING (الصفوف الموجودة تبقى كما هي)
      Prefer: `${FORCE ? "resolution=merge-duplicates" : "resolution=ignore-duplicates"},return=representation`,
    },
    body: JSON.stringify(rows),
  });

try {
  console.log("→ الزرع في:", url);
  console.log(
    FORCE
      ? "  ⚠️  وضع الاستبدال (--force): ستُستبدل الصفوف الموجودة."
      : "  ℹ️  إدراج الناقص فقط — لن تُستبدل الصفوف الموجودة. للاستبدال: npm run db:seed:force"
  );

  // تحقق من وجود الجداول قبل أي كتابة — رسالة واضحة بدل خطأ غامض
  try {
    await rest(url, key, "categories?select=slug&limit=1");
  } catch (err) {
    if (err.status === 404 || err.code === "PGRST205") {
      console.error(
        "\n✗ الجداول غير موجودة في المشروع.\n" +
          "  نفّذ محتوى supabase/schema.sql في Supabase → SQL Editor، ثم أعد المحاولة.\n"
      );
      process.exit(1);
    }
    throw err;
  }

  const addedCategories = await upsert(
    "categories",
    categories.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      name_en: c.nameEn,
      parent: c.parent ?? null,
      gender: c.gender ?? null,
      blurb: c.blurb,
      sort_order: i,
    }))
  );
  console.log(
    `  ✓ التصنيفات: أُضيف ${addedCategories.length} · موجود مسبقاً ${categories.length - addedCategories.length}`
  );

  const addedProducts = await upsert(
    "products",
    products.map((p, i) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle,
      category: p.category,
      gender: p.gender,
      price: p.price,
      compare_at: p.compareAt ?? null,
      rating: p.rating,
      reviews: p.reviews,
      badge: p.badge ?? null,
      artwork: p.artwork,
      tone: p.tone,
      options: p.options ?? null,
      colors: p.colors ?? null,
      notes: p.notes ?? null,
      description: p.description,
      features: p.features,
      stock: p.stock,
      active: true,
      sort_order: i,
    }))
  );
  console.log(
    `  ✓ المنتجات: أُضيف ${addedProducts.length} · موجود مسبقاً ${products.length - addedProducts.length}`
  );

  const [cats, prods, orders] = await Promise.all([
    rest(url, key, "categories?select=slug"),
    rest(url, key, "products?select=id"),
    rest(url, key, "orders?select=id"),
  ]);

  console.log(
    `✓ اكتمل الزرع — ${cats.length} تصنيفاً · ${prods.length} منتجاً · ${orders.length} طلباً`
  );
} catch (err) {
  console.error("✗ فشل الزرع:", err.message);
  process.exitCode = 1;
}
