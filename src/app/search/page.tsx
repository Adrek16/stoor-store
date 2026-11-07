import type { Metadata } from "next";
import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import { SearchIcon } from "@/components/icons";
import { searchProducts } from "@/lib/catalog-ops";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث في كل منتجات المتجر — عطور وإكسسوارات.",
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className="container-x py-10">
      <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">البحث</h1>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBody({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { products } = await getCatalog();
  const results = q ? searchProducts(products, q) : [];
  const suggestions = products.slice(0, 4);

  return (
    <>
      <form action="/search" className="mt-5 flex max-w-2xl items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-white px-4 py-3 focus-within:border-copper">
          <SearchIcon className="size-5 text-ink-mute" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث عن عطر، سلسلة، حقيبة…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          بحث
        </button>
      </form>

      {q && (
        <p className="mt-6 text-[0.84rem] text-ink-soft">
          نتائج البحث عن <span className="font-bold text-ink">“{q}”</span> —{" "}
          <span className="num">{results.length}</span> نتيجة
        </p>
      )}

      {q && results.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="font-bold text-ink">لا توجد نتائج مطابقة</p>
          <p className="mt-1 text-sm text-ink-mute">
            جرّب كلمة أقصر، أو تصفّح الأقسام من القائمة.
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
        {(q ? results : suggestions).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {!q && (
        <p className="mt-6 text-[0.78rem] text-ink-mute">
          مقترحات لك — اكتب كلمة للبحث في كل المتجر.
        </p>
      )}
    </>
  );
}

function SearchSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mt-5 h-12 max-w-2xl rounded-full bg-sand" />
      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="aspect-square rounded-2xl bg-sand/70" />
            <div className="mt-3 h-3 w-2/3 rounded bg-sand/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
