"use client";

import { useSyncExternalStore } from "react";

/**
 * السنة الحالية تُقرأ من ساعة المتصفح بعد الترطيب.
 *
 * نستخدم `useSyncExternalStore` بدل `useEffect + useState`: الأخير يُنفّذ
 * setState داخل الـ effect فيسبّب رسمة إضافية (ويمنعه React Compiler).
 * هنا الخادم يعرض `fallback` الثابت، والعميل يقرأ السنة الحقيقية.
 */
const subscribe = () => () => {};

export default function CopyrightYear({ fallback = 2026 }: { fallback?: number }) {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => fallback
  );

  return <>{year}</>;
}
