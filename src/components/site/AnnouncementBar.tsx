"use client";

import type { StoreInfo } from "@/lib/store-info";

/** شريط إعلانات متحرك — نصوصه من معلومات المتجر، بلا وعود توصيل. */
function Row({ messages }: { messages: string[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {messages.map((m, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 text-[0.78rem] font-semibold tracking-wide text-white/90">
            {m}
          </span>
          <span aria-hidden className="text-copper-light/60 text-[0.6rem]">
            ✦
          </span>
        </span>
      ))}
    </div>
  );
}

export default function AnnouncementBar({ info }: { info: StoreInfo }) {
  const messages = [
    info.welcomeLine1,
    "طرق الدفع تظهر عند إتمام الطلب",
    "الاستلام من المتجر",
    info.workingHours || "رفع إيصال التحويل من صفحة الطلب",
  ].filter(Boolean);

  return (
    <div className="relative overflow-hidden bg-ink text-white">
      <div className="flex w-max animate-marquee">
        <Row messages={messages} />
        <Row messages={messages} />
      </div>
      {/* soft edge fades */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent" />
    </div>
  );
}
