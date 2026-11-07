import { hasSupabase, sbSelect, sbUpsert } from "./supabase";

/**
 * طرق الدفع العامة المحفوظة في جدول `settings` (مفتاح → قيمة JSON).
 *
 * تُقرأ من الخادم بمفتاح `service_role` فقط (RLS مفعّل بلا سياسات)،
 * ويعدّلها المدير من لوحة «مدير». القائمة نفسها التي يراها العميل.
 *
 * الشكل مطابق تماماً لما تحفظه لوحة المدير:
 *   { id, type: "bank"|"wallet", name, accountName, accountNumber, note, active, sort }
 */

export type PaymentMethodType = "bank" | "wallet";

export type PaymentMethod = {
  id: string;
  type: PaymentMethodType;
  name: string;
  accountName: string;
  accountNumber: string;
  note: string;
  active: boolean;
  sort: number;
};

const METHODS_KEY = "payment_methods";
const LEGACY_BANK_KEY = "bank_transfer";

const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function cleanMethod(input: unknown, index: number): PaymentMethod {
  const raw = (input ?? {}) as Record<string, unknown>;
  const type: PaymentMethodType = raw.type === "wallet" ? "wallet" : "bank";
  return {
    id: str(raw.id, 60),
    type,
    name: str(raw.name, 80),
    accountName: str(raw.accountName, 120),
    accountNumber: str(raw.accountNumber, 60),
    note: str(raw.note, 300),
    active: raw.active !== false,
    sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : index + 1,
  };
}

function cleanList(raw: unknown): PaymentMethod[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .slice(0, 10)
    .map((item, index) => cleanMethod(item, index))
    .filter((method) => {
      if (!method.name || !method.id || seen.has(method.id)) return false;
      seen.add(method.id);
      return true;
    })
    .sort((a, b) => a.sort - b.sort)
    .map((method, index) => ({ ...method, sort: index + 1 }));
}

/** توافق خلفي: بيانات الحساب البنكي القديمة → طريقة واحدة. */
function legacyMethod(bank: Record<string, unknown> | null | undefined): PaymentMethod | null {
  const iban = str(bank?.iban, 34).replace(/\s+/g, "").toUpperCase();
  if (!iban) return null;
  return {
    id: "pm_bank_legacy",
    type: "bank",
    name: str(bank?.bankName, 80) || "تحويل بنكي",
    accountName: str(bank?.accountName, 120),
    accountNumber: iban,
    note: str(bank?.note, 300),
    active: true,
    sort: 1,
  };
}

async function readKey<T>(key: string): Promise<T | null> {
  const rows = await sbSelect<{ value: T | null }>(
    "settings",
    `select=value&key=eq.${encodeURIComponent(key)}&limit=1`
  );
  return rows[0]?.value ?? null;
}

/** كل طرق الدفع (بما فيها المعطّلة) — للخادم والتحقق. */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  if (!hasSupabase) return [];
  try {
    const list = cleanList(await readKey<unknown>(METHODS_KEY));
    if (list.length > 0) return list;

    const legacy = legacyMethod(await readKey<Record<string, unknown>>(LEGACY_BANK_KEY));
    return legacy ? [legacy] : [];
  } catch (err) {
    console.error("[settings] read payment methods failed", err instanceof Error ? err.message : err);
    return [];
  }
}

/** الطرق المفعّلة فقط — ما يعرضه المتجر للعميل. */
export async function getActivePaymentMethods(): Promise<PaymentMethod[]> {
  const methods = await getPaymentMethods();
  return methods.filter((method) => method.active);
}

/**
 * يتحقق أن الطلب يشير إلى طريقة مفعّلة من النوع المطلوب.
 * يعيد الطريقة أو null.
 */
export async function resolvePaymentMethod(
  id: string,
  type: PaymentMethodType
): Promise<PaymentMethod | null> {
  if (!id) return null;
  const methods = await getActivePaymentMethods();
  return methods.find((method) => method.id === id && method.type === type) ?? null;
}

/** حفظ طرق الدفع — من لوحة المدير فقط (اختياري للمتجر). */
export async function savePaymentMethods(
  input: PaymentMethod[]
): Promise<PaymentMethod[]> {
  if (!hasSupabase) throw new Error("Supabase غير مُهيّأ");
  const value = cleanList(input);
  await sbUpsert("settings", [{ key: METHODS_KEY, value }], "key");
  return value;
}
