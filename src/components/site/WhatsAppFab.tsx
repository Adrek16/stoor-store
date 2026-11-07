"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/icons";
import type { StoreInfo } from "@/lib/store-info";

export default function WhatsAppFab({ info }: { info: StoreInfo }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const number = info.whatsapp.replace(/\D/g, "");
  // لا رقم؟ لا زر — بدل رابط واتساب مكسور.
  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent("مرحباً، أرغب بالاستفسار عن منتج")}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا على واتساب"
      className={`fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-[#1faa53] py-3 ps-3 pe-4 text-sm font-bold text-white shadow-[0_12px_30px_-10px_rgba(31,170,83,0.9)] transition-all duration-300 hover:bg-[#188c44] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <WhatsAppIcon className="size-6" />
      <span className="hidden sm:inline">اطلب واتساب</span>
    </a>
  );
}
