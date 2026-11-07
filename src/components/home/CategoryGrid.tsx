import Link from "next/link";
import ProductArtwork from "@/components/ProductArtwork";
import SectionHeader from "@/components/SectionHeader";
import type { ArtworkKind, Category } from "@/lib/types";

const tiles: {
  href: string;
  name: string;
  kind: ArtworkKind;
  tone: string;
}[] = [
  { href: "/category/men-perfumes", name: "عطور رجالية", kind: "perfume", tone: "#6d4a33" },
  { href: "/category/women-perfumes", name: "عطور نسائية", kind: "perfume", tone: "#a24a5a" },
  { href: "/category/necklaces", name: "سلاسل", kind: "necklace", tone: "#d4a857" },
  { href: "/category/earrings", name: "أقراط", kind: "earrings", tone: "#d9b98d" },
  { href: "/category/rings", name: "خواتم", kind: "ring", tone: "#8b9499" },
  { href: "/category/watches", name: "ساعات", kind: "watch", tone: "#5a4433" },
  { href: "/category/bracelets", name: "أساور", kind: "bracelet", tone: "#d8a48f" },
];

export default function CategoryGrid({ categories = [] }: { categories?: Category[] }) {
  const bag = categories.find((category) => category.parent === "bags");

  // بطاقة الحقائب تتبع أول تصنيف حقيقي أضافه المدير، وتعود لصفحة
  // كل التصنيفات إن لم يُضف بعد — فلا يظهر رابط مكسور.
  const allTiles = [
    ...tiles,
    {
      href: bag ? `/category/${bag.slug}` : "/categories",
      name: bag?.name || "حقائب",
      kind: "bag" as const,
      tone: "#9a6f4d",
    },
  ];

  return (
    <section className="container-x py-14">
      <SectionHeader
        eyebrow="تصفّح بسرعة"
        title="تسوّق حسب التصنيف"
        description="ابدأ من الفئة التي تهمّك — عطور، إكسسوارات، وحقائب مختارة بعناية."
        href="/categories"
        linkLabel="كل التصنيفات"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {allTiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-line-soft bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:border-copper/40 hover:shadow-[0_18px_36px_-24px_rgba(35,29,27,0.5)]"
          >
            <span className="size-full max-w-[92px] overflow-hidden rounded-full bg-sand/60 ring-1 ring-line/60 transition-transform duration-500 group-hover:scale-105">
              <ProductArtwork kind={t.kind} tone={t.tone} className="size-full" strokeScale={2.1} />
            </span>
            <span className="text-center text-[0.78rem] font-bold text-ink">{t.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
