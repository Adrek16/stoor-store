"use client";

import { useState } from "react";
import { ChevronIcon } from "@/components/icons";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setDone(true);
    setEmail("");
  }

  return (
    <section className="container-x pb-4">
      <div className="flex flex-col items-center gap-5 rounded-[1.5rem] border border-line bg-white px-6 py-9 text-center md:flex-row md:justify-between md:text-right">
        <div>
          <h2 className="text-lg font-extrabold text-ink">كن أول من يعرف</h2>
          <p className="mt-1 text-[0.82rem] text-ink-soft">
            إصدارات جديدة وخصومات حصرية — رسالة واحدة كل أسبوعين، لا أكثر.
          </p>
        </div>

        {done ? (
          <p className="rounded-full bg-success/10 px-5 py-3 text-[0.82rem] font-bold text-success">
            تم التسجيل — شكراً لك ✓
          </p>
        ) : (
          <form onSubmit={submit} className="flex w-full max-w-md gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="w-full rounded-full border border-line bg-cream px-4 py-3 text-sm outline-none transition-colors placeholder:text-ink-mute focus:border-copper"
            />
            <button type="submit" className="btn btn-primary shrink-0 !px-5">
              اشترك
              <ChevronIcon className="size-4" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
