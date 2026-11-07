import Link from "next/link";
import Logo from "./Logo";
import CopyrightYear from "./CopyrightYear";
import type { Category } from "@/lib/types";
import type { StoreInfo } from "@/lib/store-info";

const helpLinks = [
  { href: "/shipping", label: "الاستلام من المتجر" },
  { href: "/returns", label: "الاستبدال والاسترجاع" },
  { href: "/care", label: "دليل العناية بالقطع" },
  { href: "/faq", label: "الأسئلة الشائعة" },
  { href: "/contact", label: "تواصل معنا" },
];

const aboutLinks = [
  { href: "/about", label: "نبذة عنا" },
  { href: "/blog", label: "المدونة" },
  { href: "/privacy", label: "سياسة الخصوصية" },
  { href: "/terms", label: "الشروط والأحكام" },
];

export default function Footer({
  categories,
  info,
}: {
  categories: Category[];
  info: StoreInfo;
}) {
  // نعرض فقط حسابات التواصل التي يضبطها المدير.
  const socials = [
    { href: info.social.instagram, label: "Instagram", d: "M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1ZM17 6.9a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 17 6.9ZM12 3.6c-2.3 0-2.6 0-3.5.05a4.9 4.9 0 0 0-1.7.33 3.6 3.6 0 0 0-2.1 2.1 4.9 4.9 0 0 0-.33 1.7C4.3 8.6 4.3 8.9 4.3 12s0 3.4.05 4.3a4.9 4.9 0 0 0 .33 1.7 3.6 3.6 0 0 0 2.1 2.1 4.9 4.9 0 0 0 1.7.33c.9.05 1.2.05 3.5.05s2.6 0 3.5-.05a4.9 4.9 0 0 0 1.7-.33 3.6 3.6 0 0 0 2.1-2.1 4.9 4.9 0 0 0 .33-1.7c.05-.9.05-1.2.05-4.3s0-3.4-.05-4.3a4.9 4.9 0 0 0-.33-1.7 3.6 3.6 0 0 0-2.1-2.1 4.9 4.9 0 0 0-1.7-.33C14.6 3.6 14.3 3.6 12 3.6Z" },
    { href: info.social.tiktok, label: "TikTok", d: "M16.5 3h-2.6v11.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.2a5.3 5.3 0 1 0 4.4 5.2V8.9a6.2 6.2 0 0 0 3.5 1.1V7.4a3.6 3.6 0 0 1-3.5-3.5V3Z" },
    { href: info.social.snapchat, label: "Snapchat", d: "M12 3.5c2.4 0 3.9 1.7 3.9 4 0 .7-.1 1.3-.1 1.7.2.1.5 0 .9-.2.5-.2 1 .3.8.8-.2.6-1 1-1.4 1.2.5 1.4 1.6 2.3 2.8 2.6.4.1.4.6 0 .8-.7.3-1.4.3-1.8.8-.2.3-.2.7-.6.8-.6.2-1.3-.3-2-.2-.9.2-1.4 1.2-2.5 1.2s-1.6-1-2.5-1.2c-.7-.1-1.4.4-2 .2-.4-.1-.4-.5-.6-.8-.4-.5-1.1-.5-1.8-.8-.4-.2-.4-.7 0-.8 1.2-.3 2.3-1.2 2.8-2.6-.4-.2-1.2-.6-1.4-1.2-.2-.5.3-1 .8-.8.4.2.7.3.9.2 0-.4-.1-1-.1-1.7 0-2.3 1.5-4 3.9-4Z" },
    { href: info.social.x, label: "X", d: "M4.5 4h3.2l4 5.3L16.4 4h3.1l-6 7.4L20 20h-3.2l-4.3-5.7L7.3 20H4.2l6.3-7.8L4.5 4Z" },
  ].filter((s) => Boolean(s.href));

  return (
    <footer className="relative mt-24 bg-ink text-white/70">
      {/* Curved top edge — a detail borrowed from the reference store */}
      <svg
        aria-hidden
        viewBox="0 0 1440 54"
        preserveAspectRatio="none"
        className="absolute -top-10 left-0 z-0 h-10 w-full text-ink sm:-top-16 sm:h-16"
      >
        <path
          fill="currentColor"
          d="M0 22L120 16.7C240 11 480 1 720 .7 960 1 1200 11 1320 16.7L1440 22V54H1320C1200 54 960 54 720 54 480 54 240 54 120 54H0V22Z"
        />
      </svg>

      <div className="relative z-10 container-x pt-14 pb-10">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <div className="mb-4 text-white">
              <Logo inverted info={info} />
            </div>
            <p className="max-w-sm text-sm leading-7">{info.about || info.description}</p>
            <div className="mt-4 space-y-1 text-[0.8rem] text-white/55">
              {info.address && <p>{info.address}</p>}
              {info.workingHours && <p>{info.workingHours}</p>}
            </div>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid size-9 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-copper hover:text-copper"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                      <path d={s.d} />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="lg:col-span-3">
            <h3 className="mb-4 text-sm font-bold text-white">تسوّق</h3>
            <ul className="space-y-2.5 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="transition-colors hover:text-copper">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-bold text-white">المساعدة</h3>
            <ul className="space-y-2.5 text-sm">
              {helpLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-copper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div className="lg:col-span-3">
            <h3 className="mb-4 text-sm font-bold text-white">المتجر</h3>
            <ul className="space-y-2.5 text-sm">
              {aboutLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-copper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold text-white">تواصل مباشر</p>
              <a
                href={`https://wa.me/${info.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="num mt-1 block text-sm text-copper transition-colors hover:text-copper-light"
                dir="ltr"
              >
                {info.phone || info.whatsapp}
              </a>
              {info.email && (
                <a
                  href={`mailto:${info.email}`}
                  className="mt-1 block text-[0.78rem] text-white/60 transition-colors hover:text-copper"
                  dir="ltr"
                >
                  {info.email}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs md:flex-row">
          <p>© <CopyrightYear /> {info.name} — جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-2 opacity-70">
            {["الدفع عند الاستلام", "استلام من المتجر"].map((p) => (
              <span
                key={p}
                className="rounded-md border border-white/15 px-2 py-1 text-[0.62rem] font-semibold tracking-wide"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
