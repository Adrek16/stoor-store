"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const options = [
  { value: "featured", label: "الأكثر رواجاً" },
  { value: "price-asc", label: "السعر: من الأقل" },
  { value: "price-desc", label: "السعر: من الأعلى" },
  { value: "rating", label: "الأعلى تقييماً" },
];

export default function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "featured") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-[0.78rem] font-semibold text-ink-soft">
      <span className="hidden sm:inline">ترتيب:</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="cursor-pointer rounded-full border border-line bg-white px-3 py-2 text-[0.78rem] font-semibold text-ink outline-none transition-colors hover:border-copper focus:border-copper"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
