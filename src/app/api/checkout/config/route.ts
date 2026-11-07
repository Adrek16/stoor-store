import { connection, NextResponse } from "next/server";
import { getActivePaymentMethods } from "@/lib/settings";
import { site } from "@/lib/site";

/**
 * إعدادات الدفع العامة لصفحة إتمام الطلب.
 *
 * تُرجع طرق الدفع المفعّلة (بنوك ومحافظ) التي يعدّلها المدير،
 * والمهلة المسموحة لرفع الإيصال. لا تحتوي أي سر.
 */
export async function GET() {
  // تعتمد على بيانات قابلة للتغيير من لوحة المدير — لا تُبنى مسبقاً.
  await connection();

  const methods = await getActivePaymentMethods();

  return NextResponse.json(
    {
      ok: true,
      transferHoldDays: site.transferHoldDays,
      methods: methods.map((method) => ({
        id: method.id,
        type: method.type,
        name: method.name,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        note: method.note,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
