import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductGallery from "@/components/product/ProductGallery";
import BuyBox from "@/components/product/BuyBox";
import ProductReviews from "@/components/product/ProductReviews";
import ProductCard from "@/components/ProductCard";
import { ChevronIcon } from "@/components/icons";
import { findCategory, findProduct, relatedProducts } from "@/lib/catalog-ops";
import { getCatalog } from "@/lib/catalog";
import { site } from "@/lib/site";

type Params = { slug: string };

/**
 * صفحة المنتج تعتمد كلياً على `slug`، فلا معنى لعرض هيكل فوري ثم استبداله.
 * نُعلن صراحةً أن التنقّل إليها ينتظر البيانات — بدل تحذير Next في التطوير.
 */
export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const { products } = await getCatalog();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { products } = await getCatalog();
  const product = findProduct(products, slug);
  if (!product) return { title: "منتج غير موجود" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: `${product.name} — ${site.name}`,
      description: product.description.slice(0, 160),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const { products, categories } = await getCatalog();

  const product = findProduct(products, slug);
  if (!product) notFound();

  const category = findCategory(categories, product.category);
  const related = relatedProducts(products, product, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: site.name },
    ...(product.reviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviews,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "YER",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-x pt-6">
        <nav className="flex items-center gap-1.5 text-[0.72rem] text-ink-mute">
          <Link href="/" className="hover:text-copper-dark">الرئيسية</Link>
          <ChevronIcon className="size-3" />
          {category && (
            <>
              <Link href={`/category/${category.slug}`} className="hover:text-copper-dark">
                {category.name}
              </Link>
              <ChevronIcon className="size-3" />
            </>
          )}
          <span className="font-semibold text-ink">{product.name}</span>
        </nav>
      </div>

      <section className="container-x grid gap-8 py-7 lg:grid-cols-2 lg:gap-12">
        <ProductGallery product={product} />
        <BuyBox product={product} />
      </section>

      {/* Details */}
      <section className="container-x pb-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Notes pyramid */}
          {product.notes && (
            <div className="rounded-2xl border border-line-soft bg-white p-6">
              <h2 className="mb-4 text-base font-extrabold text-ink">هرم النوتات</h2>
              <div className="space-y-4">
                {[
                  { label: "المقدمة", values: product.notes.top },
                  { label: "القلب", values: product.notes.heart },
                  { label: "القاعدة", values: product.notes.base },
                ].map((row, i) => (
                  <div key={row.label} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className="grid size-9 place-items-center rounded-full text-[0.66rem] font-bold"
                        style={{
                          background: `${product.tone}${["22", "33", "44"][i]}`,
                          color: product.tone,
                        }}
                      >
                        {i + 1}
                      </span>
                      {i < 2 && <span className="mt-1 h-6 w-px bg-line" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-[0.76rem] font-bold text-ink">{row.label}</p>
                      <p className="mt-0.5 text-[0.82rem] text-ink-soft">
                        {row.values.join(" · ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accordions */}
          <div className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-white">
            <details open className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[0.88rem] font-bold text-ink">
                المواصفات
                <ChevronIcon className="size-4 transition-transform group-open:-rotate-90" />
              </summary>
              <ul className="mt-3 space-y-1.5 text-[0.82rem] text-ink-soft">
                {product.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-copper" />
                    {f}
                  </li>
                ))}
              </ul>
            </details>

            <details className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[0.88rem] font-bold text-ink">
                الاستلام من المتجر / التواصل عبر واتساب
                <ChevronIcon className="size-4 transition-transform group-open:-rotate-90" />
              </summary>
              <p className="mt-3 text-[0.82rem] leading-7 text-ink-soft">
                يمكنكم استلام الطلب من المتجر مباشرة، أو التواصل معنا عبر واتساب
                لترتيب الطلب والإجابة عن أي استفسار.
              </p>
            </details>

            <details className="group px-6 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[0.88rem] font-bold text-ink">
                الاستبدال والاسترجاع
                <ChevronIcon className="size-4 transition-transform group-open:-rotate-90" />
              </summary>
              <p className="mt-3 text-[0.82rem] leading-7 text-ink-soft">
                يمكنك الاستبدال أو الاسترجاع خلال 14 يوماً من الاستلام، بشرط أن تكون
                القطعة بحالتها الأصلية وبتغليفها. العطور المفتوحة غير قابلة للاسترجاع
                لأسباب صحية.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <ProductReviews
        productId={product.id}
        productSlug={product.slug}
        initialRating={product.rating}
        initialCount={product.reviews}
      />

      {/* Related */}
      {related.length > 0 && (
        <section className="container-x py-12">
          <h2 className="mb-6 text-xl font-extrabold text-ink">قد يعجبك أيضاً</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
