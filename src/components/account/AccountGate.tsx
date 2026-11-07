"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * بوابة دخول/تسجيل العميل.
 *
 * تُرسل البيانات إلى الخادم (Supabase Auth بمفتاح anon)؛ المتصفح لا يتعامل
 * مع أي مفتاح Supabase. عند النجاح يُعاد توجيه العميل إلى الصفحة المطلوبة.
 */
export default function AccountGate({ nextPath = "/account" }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm outline-none focus:border-copper";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const endpoint = mode === "login" ? "/api/account/session" : "/api/account/register";
    const payload =
      mode === "login"
        ? { email, password }
        : { email, password, fullName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "تعذّر إتمام العملية — حاول مرة أخرى");
        setLoading(false);
        return;
      }

      // نجح — أعِد تحميل الصفحة لعرض اللوحة، ثم وجّه إلى الصفحة المطلوبة.
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم — تحقّق من الشبكة وحاول مرة أخرى");
      setLoading(false);
    }
  }

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-sm rounded-2xl border border-line-soft bg-white p-6">
        {/* التبديل بين الدخول والتسجيل */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-sand p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-full py-2 text-[0.82rem] font-bold transition-colors ${
              mode === "login" ? "bg-white text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            دخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-full py-2 text-[0.82rem] font-bold transition-colors ${
              mode === "register" ? "bg-white text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            حساب جديد
          </button>
        </div>

        <h1 className="text-lg font-extrabold text-ink">
          {mode === "login" ? "دخول إلى حسابي" : "إنشاء حساب جديد"}
        </h1>
        <p className="mt-1 text-[0.8rem] leading-6 text-ink-soft">
          {mode === "login"
            ? "تابع طلباتك السابقة وأدر بياناتك."
            : "انضمّ لتتبّع طلباتك والاستمتاع بتجربة أسرع."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-[0.72rem] font-semibold text-ink-soft">
                الاسم الكامل
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: نورة العتيبي"
                autoComplete="name"
                className={inputCls}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[0.72rem] font-semibold text-ink-soft">
              البريد الإلكتروني
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              autoFocus
              dir="ltr"
              className={`${inputCls} text-right`}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.72rem] font-semibold text-ink-soft">
              كلمة المرور
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={inputCls}
            />
          </label>

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading
              ? "جارٍ التحقق…"
              : mode === "login"
                ? "دخول"
                : "إنشاء الحساب"}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-lg bg-maroon/5 px-3 py-2 text-[0.74rem] font-semibold text-maroon">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
