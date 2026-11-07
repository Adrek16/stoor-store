/**
 * ينفّذ استعلام SQL على قاعدة بيانات Supabase عبر Management API.
 *
 * الاستخدام:
 *   node scripts/db-sql.mjs "select 1"
 *   node scripts/db-sql.mjs --file supabase/migrations/001_x.sql
 *   node scripts/db-sql.mjs "select * from products limit 3" --json
 *
 * هذه هي نفس الآلية التي تستخدمها أداة execute_sql في خادم Supabase MCP،
 * وتعمل بدون كلمة مرور قاعدة البيانات — يكفي SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "./_env.mjs";

loadEnvLocal();

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!REF) {
  console.error("✗ SUPABASE_PROJECT_REF غير موجود في .env.local");
  process.exit(1);
}
if (!PAT) {
  console.error("✗ SUPABASE_ACCESS_TOKEN غير موجود في .env.local");
  process.exit(1);
}

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const fileIdx = argv.indexOf("--file");
let sql;

if (fileIdx !== -1) {
  const file = argv[fileIdx + 1];
  sql = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
} else {
  sql = argv.filter((a) => a !== "--json").join(" ");
}

if (!sql.trim()) {
  console.error("الاستخدام: node scripts/db-sql.mjs \"<sql>\" [--json] | --file <path>");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${PAT}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();

if (!res.ok) {
  console.error(`✗ Management API ${res.status}`);
  try {
    const parsed = JSON.parse(text);
    console.error(parsed.message ?? parsed.error ?? text.slice(0, 800));
  } catch {
    console.error(text.slice(0, 800));
  }
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} else {
  console.log(text);
}
