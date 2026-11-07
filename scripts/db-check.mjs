/**
 * فحص صحة الاتصال بقاعدة البيانات.
 * الاستخدام: npm run db:check
 * يفحص: مفتاح REST، وجود الجداول، عدد الصفوف، واتصال Postgres المباشر (إن وُجد).
 */
import pg from "pg";
import { loadEnvLocal, redact, rest } from "./_env.mjs";

loadEnvLocal();

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("── Supabase REST ─────────────────────────────");

if (!url || !key) {
  console.log("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY غير مضبوطين");
} else {
  console.log("  المشروع:", url);
  console.log("  المفتاح:", key.startsWith("eyJ") ? "JWT (service_role)" : key.slice(0, 16) + "…");

  const tables = ["categories", "products", "orders"];
  let missing = 0;

  for (const t of tables) {
    try {
      const rows = await rest(url, key, `${t}?select=*`);
      console.log(`  ✓ ${t.padEnd(11)} ${String(rows.length).padStart(4)} صفاً`);
    } catch (err) {
      missing++;
      const hint = err.code === "PGRST205" ? "الجدول غير موجود" : err.message;
      console.log(`  ✗ ${t.padEnd(11)} ${hint}`);
    }
  }

  if (missing) {
    console.log(
      "\n  ← نفّذ محتوى supabase/schema.sql في Supabase → SQL Editor\n" +
        "    ثم: npm run db:seed"
    );
  }
}

console.log("\n── Postgres مباشر (اختياري) ──────────────────");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("  — غير مضبوط (لا حاجة له إذا كان REST يعمل)");
} else {
  console.log("  " + redact(dbUrl));
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("select current_user as u, current_database() as d");
    console.log(`  ✓ متصل — ${rows[0].u} / ${rows[0].d}`);
  } catch (err) {
    console.log(`  ✗ ${err.code ?? ""} ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}
