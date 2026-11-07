import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import SortSelect from "@/components/SortSelect";
import { ChevronIcon } from "@/components/icons";
import { findCategory, isSortKey, productsInCategory, sortProducts } from "@/lib/catalog-ops";
import { getCatalog } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const { categories } = await getCatalog();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { categories } = await getCatalog();
  const category = findCategory(categories, slug);
  if (!category) return { title: "قسم غير موجود" };
  return {
    title: category.name,
    description: `${category.name} — ${category.blurb}. تسوّق أونلاين مع الاستلام من المتجر.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { products, categories } = await getCatalog();

  const category = findCategory(categories, slug);
  if (!category) notFound();

  const items = productsInCategory(products, slug);
  const siblings = categories.filter(
    (c) => c.parent === category.parent && c.slug !== category.slug
  );
  const parentLabel =
    category.parent === "perfumes"
      ? "العطور"
      : category.parent === "accessories"
        ? "الإكسسوارات"
        : category.parent === "bags"
          ? "الحقائب"
          : "كل التصنيفات";

  return (
    <div>
      {/* Category hero — static shell, paints immediately */}
      <section className="border-b border-line bg-gradient-to-b from-sand/60 to-cream">
        <div className="container-x py-8 md:py-10">
          <nav className="mb-4 flex items-center gap-1.5 text-[0.72rem] text-ink-mute">
            <Link href="/" className="hover:text-copper-dark">
              الرئيسية
            </Link>
            <ChevronIcon className="size-3" />
            <Link href="/categories" className="hover:text-copper-dark">
              {parentLabel}
            </Link>
            <ChevronIcon className="size-3" />
            <span className="font-semibold text-ink">{category.name}</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {category.name}
              </h1>
              <p className="mt-2 max-w-xl text-[0.88rem] leading-7 text-ink-soft">
                {category.blurb}
              </p>
            </div>
            <p className="num text-[0.78rem] text-ink-mute">{items.length} منتج</p>
          </div>
        </div>
      </section>

      <div className="container-x py-8">
        <Suspense fallback={<ListingSkeleton />}>
          <Listing
            items={items}
            category={category}
            siblings={siblings}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </div>
  );
}

async function Listing({
  items,
  category,
  siblings,
  searchParams,
}: {
  items: Product[];
  category: Category;
  siblings: Category[];
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sorted = sortProducts(items, isSortKey(sort) ? sort : "featured");

  return (
    <>
      {/* Filter / sort bar */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <Link
            href={`/category/${category.slug}`}
            className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[0.76rem] font-bold text-white"
          >
            {category.name}
          </Link>
          {siblings.map((s) => (
            <Link
              key={s.slug}
              href={`/category/${s.slug}`}
              className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[0.76rem] font-semibold text-ink-soft transition-colors hover:border-copper hover:text-copper-dark"
            >
              {s.name}
            </Link>
          ))}
        </div>
        <SortSelect value={sort ?? "featured"} />
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-20 text-center">
          <p className="font-bold text-ink">لا توجد منتجات في هذا القسم بعد</p>
          <p className="mt-1 text-sm text-ink-mute">نضيف قطعاً جديدة كل أسبوع.</p>
          <Link href="/categories" className="btn btn-outline mt-5">
            تصفّح الأقسام الأخرى
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {sorted.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}

function ListingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-7 flex items-center justify-between border-b border-line pb-4">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-sand" />
          ))}
        </div>
        <div className="h-9 w-32 rounded-full bg-sand" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i}>
            <div className="aspect-square rounded-2xl bg-sand/70" />
            <div className="mt-3 h-3 w-2/3 rounded bg-sand/70" />
            <div className="mt-2 h-3 w-1/3 rounded bg-sand/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
