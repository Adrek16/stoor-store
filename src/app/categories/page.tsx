import type { Metadata } from "next";
import Link from "next/link";
import ProductArtwork from "@/components/ProductArtwork";
import { ChevronIcon } from "@/components/icons";
import { productsInCategory } from "@/lib/catalog-ops";
import { getCatalog } from "@/lib/catalog";
import { categoryArtwork, categoryTone } from "@/lib/category-artwork";

export const metadata: Metadata = {
  title: "كل التصنيفات",
  description: "تصفّح كل أقسام المتجر — عطور، إكسسوارات، وحقائب.",
};

export default async function CategoriesPage() {
  const { products, categories } = await getCatalog();

  const groups = [
    {
      key: "perfumes",
      label: "العطور",
      desc: "تركيبات شرقية وفرنسية بثبات عالٍ",
      items: categories.filter((c) => c.parent === "perfumes"),
    },
    {
      key: "accessories",
      label: "الإكسسوارات",
      desc: "معادن مطليّة وقطع جلدية",
      items: categories.filter((c) => c.parent === "accessories"),
    },
    {
      key: "bags",
      label: "الحقائب",
      desc: "حقائب أنيقة لكل يوم ومناسبة",
      items: categories.filter((c) => c.parent === "bags"),
    },
  ];

  // تصنيفات أضافها المدير بلا قسم رئيسي (أو بقسم غير معروف) لا تُخفى.
  const others = categories.filter(
    (c) => !["perfumes", "accessories", "bags"].includes(c.parent ?? "")
  );
  if (others.length) {
    groups.push({
      key: "others",
      label: "تصنيفات أخرى",
      desc: "أقسام إضافية من الكتالوج",
      items: others,
    });
  }

  return (
    <div className="container-x py-10">
      <nav className="mb-4 flex items-center gap-1.5 text-[0.72rem] text-ink-mute">
        <Link href="/" className="hover:text-copper-dark">الرئيسية</Link>
        <ChevronIcon className="size-3" />
        <span className="font-semibold text-ink">كل التصنيفات</span>
      </nav>

      <h1 className="text-3xl font-extrabold text-ink">كل التصنيفات</h1>
      <p className="mt-2 max-w-lg text-[0.88rem] leading-7 text-ink-soft">
        اختر القسم الذي يناسبك — كل تصنيف يحتوي على منتجات مختارة ومتوفرة الآن.
      </p>

      {groups.map((g) => {
        const list = g.items;
        return (
          <section key={g.key} className="mt-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-xl font-extrabold text-ink">{g.label}</h2>
              <span className="text-[0.76rem] text-ink-mute">{g.desc}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line-soft bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-copper/40 hover:shadow-[0_16px_32px_-24px_rgba(35,29,27,0.5)]"
                >
                  <span className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand/60">
                    <ProductArtwork
                      kind={categoryArtwork(c)}
                      tone={categoryTone(c)}
                      className="size-full"
                      strokeScale={2}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[0.95rem] font-bold text-ink">{c.name}</span>
                      <span className="num text-[0.68rem] text-ink-mute">
                        {productsInCategory(products, c.slug).length}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.74rem] text-ink-mute">
                      {c.blurb}
                    </span>
                  </span>
                  <ChevronIcon className="size-4 shrink-0 text-ink-mute transition-transform group-hover:-translate-x-1 group-hover:text-copper" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
