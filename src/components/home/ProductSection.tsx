import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import type { Product } from "@/lib/types";

export default function ProductSection({
  id,
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  products,
  limit = 4,
  tone = "cream",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  products: Product[];
  limit?: number;
  tone?: "cream" | "white";
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${tone === "white" ? "border-y border-line bg-white" : ""}`}
    >
      <div className="container-x py-14">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          href={href}
          linkLabel={linkLabel}
        />
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, limit).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
