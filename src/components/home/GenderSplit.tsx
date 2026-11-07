import Link from "next/link";
import ProductArtwork from "@/components/ProductArtwork";
import { ChevronIcon } from "@/components/icons";

const blocks = [
  {
    href: "/category/men-perfumes",
    eyebrow: "FOR HIM",
    title: "قسم الرجال",
    body: "عود، عنبر، وتوباكو — عطور ثقيلة الحضور، وساعات وأساور جلدية.",
    bg: "from-[#2b211c] to-[#4a362b]",
    text: "text-white",
    sub: "text-white/65",
    artwork: { kind: "perfume" as const, tone: "#c9a227" },
    cta: "text-white border-white/25 hover:border-copper",
  },
  {
    href: "/category/women-perfumes",
    eyebrow: "FOR HER",
    title: "قسم النساء",
    body: "ورد، ياسمين، ومسك — مع سلاسل وأقراط وأطقم تكمل الإطلالة.",
    bg: "from-[#f3e3d8] to-[#e8cfc0]",
    text: "text-ink",
    sub: "text-ink/65",
    artwork: { kind: "necklace" as const, tone: "#b06a4f" },
    cta: "text-ink border-ink/20 hover:border-copper",
  },
];

export default function GenderSplit() {
  return (
    <section className="container-x py-4">
      <div className="grid gap-4 md:grid-cols-2">
        {blocks.map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className={`group relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br ${b.bg} p-6 transition-transform duration-500 hover:-translate-y-1 sm:p-8`}
          >
            <div className="relative z-10 flex h-full flex-col">
              <span
                className={`text-[0.62rem] font-bold tracking-[0.34em] ${b.sub}`}
              >
                {b.eyebrow}
              </span>
              <h3 className={`mt-2 text-2xl font-extrabold ${b.text}`}>{b.title}</h3>
              <p className={`mt-2 max-w-[22rem] text-[0.85rem] leading-7 ${b.sub}`}>
                {b.body}
              </p>
              <span
                className={`mt-5 inline-flex w-fit items-center gap-1.5 rounded-full border px-4 py-2 text-[0.76rem] font-bold transition-colors ${b.cta}`}
              >
                تصفّح القسم
                <ChevronIcon className="size-3.5" />
              </span>
            </div>

            <div className="pointer-events-none absolute -bottom-10 -left-6 size-48 opacity-80 transition-transform duration-700 group-hover:scale-110 sm:size-56">
              <ProductArtwork
                kind={b.artwork.kind}
                tone={b.artwork.tone}
                className="size-full"
                bare
              />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/3 size-40 rounded-full bg-white/10 blur-2xl"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
