import Link from "next/link";
import ProductArtwork from "@/components/ProductArtwork";
import { ChevronIcon, SparkIcon } from "@/components/icons";
import type { StoreInfo } from "@/lib/store-info";

export default function Hero({ info }: { info: StoreInfo }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sand/70 via-cream to-cream">
      {/* ambient shapes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 size-[420px] rounded-full bg-copper/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-0 size-[360px] rounded-full bg-maroon/[0.06] blur-3xl"
      />

      <div className="container-x relative grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:py-20">
        {/* Copy */}
        <div className="animate-fade-up">
          <span className="eyebrow">
            <SparkIcon className="size-3.5" />
            {info.tagline}
          </span>

          <h1 className="mt-4 text-[2.1rem] font-extrabold leading-[1.18] text-ink sm:text-5xl lg:text-[3.4rem]">
            {info.welcomeLine1}
            <br />
            <span className="relative inline-block text-copper-dark">
              {info.welcomeLine2}
              <svg
                aria-hidden
                viewBox="0 0 220 12"
                className="absolute -bottom-4 right-0 h-1.5 w-full text-copper/35"
                preserveAspectRatio="none"
              >
                <path d="M2 8c40-5 90-6 140-4 30 1 55 3 76 5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-[0.98rem] leading-8 text-ink-soft">
            {info.welcomeBody}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/category/women-perfumes" className="btn btn-primary w-full justify-center sm:w-auto">
              تسوّق العطور
              <ChevronIcon className="size-4" />
            </Link>
            <Link href="/category/necklaces" className="btn btn-outline w-full justify-center sm:w-auto">
              تسوّق الإكسسوارات
            </Link>
          </div>

          {/*
            لا أرقام مُختلقة: «عميل سعيد» ووعود التوصيل أُزيلت.
            نعرض معلومات حقيقية يديرها المدير من شاشة «معلومات المتجر».
          */}
          <dl className="mt-9 grid max-w-md gap-4 border-t border-line pt-6 sm:grid-cols-2">
            {[
              { k: info.address || info.name || "المتجر", v: "موقع المتجر" },
              { k: info.workingHours || "حسب ساعات المتجر", v: "ساعات العمل" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-[0.86rem] font-extrabold text-ink">{s.k}</dt>
                <dd className="mt-0.5 text-[0.72rem] text-ink-mute">{s.v}</dd>
              </div>
            ))}
          </dl>
          {info.workingHours && (
            <p className="mt-3 text-[0.72rem] text-ink-mute">{info.workingHours}</p>
          )}
        </div>

        {/* Art composition */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="relative aspect-square">
            <div
              aria-hidden
              className="absolute inset-[6%] rounded-full bg-gradient-to-br from-copper/25 via-copper-wash to-transparent"
            />
            <div
              aria-hidden
              className="absolute inset-[14%] rounded-full border border-copper/20"
            />

            {/* Main perfume */}
            <div className="absolute left-1/2 top-1/2 w-[54%] -translate-x-1/2 -translate-y-1/2 animate-float">
              <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_30px_70px_-30px_rgba(35,29,27,0.45)] backdrop-blur">
                <ProductArtwork kind="perfume" tone="#8c5a2b" className="size-full" />
              </div>
            </div>

            {/* Necklace card */}
            <div
              className="absolute -right-2 top-6 w-[30%] animate-float rounded-2xl border border-white/70 bg-white/80 p-1 shadow-[0_18px_40px_-20px_rgba(35,29,27,0.35)] backdrop-blur"
              style={{ animationDelay: "1.2s" }}
            >
              <ProductArtwork kind="necklace" tone="#d4a857" className="size-full" strokeScale={1.6} />
            </div>

            {/* Watch card */}
            <div
              className="absolute -left-1 bottom-8 w-[28%] animate-float rounded-2xl border border-white/70 bg-white/80 p-1 shadow-[0_18px_40px_-20px_rgba(35,29,27,0.35)] backdrop-blur"
              style={{ animationDelay: "2.4s" }}
            >
              <ProductArtwork kind="watch" tone="#5a4433" className="size-full" strokeScale={1.6} />
            </div>

            {/* بطاقة الشعار — لا أسعار مُختلقة */}
            <div className="absolute bottom-2 right-2 rounded-full border border-line bg-white/90 px-3 py-1.5 text-[0.68rem] font-bold text-ink shadow-sm backdrop-blur">
              {info.name} · <span className="text-copper-dark">{info.nameEn || "STOOR"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
