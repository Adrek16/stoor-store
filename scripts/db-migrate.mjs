/**
 * ينفّذ supabase/schema.sql على قاعدة البيانات.
 * الاستخدام: npm run db:migrate
 *
 * طريقتان:
 *   1. Management API — يحتاج SUPABASE_ACCESS_TOKEN (sbp_...) + SUPABASE_PROJECT_REF.
 *      لا يحتاج كلمة مرور قاعدة البيانات.
 *   2. اتصال Postgres مباشر — يحتاج DATABASE_URL.
 *
 * آمن للتشغيل المتكرر.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnvLocal, redact, makeClient, requireDatabaseUrl } from "./_env.mjs";

loadEnvLocal();

const sqlFile = path.join(process.cwd(), "supabase", "schema.sql");
const sql = fs.readFileSync(sqlFile, "utf8");

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

async function viaManagementApi() {
  if (!REF) throw new Error("SUPABASE_PROJECT_REF غير معروف");
  console.log(`→ تنفيذ المخطط عبر Management API (${REF})`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

async function viaPostgres() {
  const url = requireDatabaseUrl();
  console.log("→ تنفيذ المخطط عبر Postgres:", redact(url));
  const client = makeClient(pg, url);
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  if (PAT) await viaManagementApi();
  else await viaPostgres();

  console.log("✓ تم تنفيذ المخطط");

  // تحقق سريع عبر REST
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    for (const table of ["categories", "products", "orders"]) {
      const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      console.log(`  ${r.ok ? "✓" : "✗"} ${table}${r.ok ? "" : ` (HTTP ${r.status})`}`);
    }
  }
} catch (err) {
  console.error("✗ فشل التنفيذ:", err.message);
  process.exitCode = 1;
}
