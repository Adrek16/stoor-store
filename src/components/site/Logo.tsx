import Link from "next/link";
import { storeAssetUrl } from "@/lib/media";
import type { StoreInfo } from "@/lib/store-info";

export default function Logo({
  info,
  className = "",
  compact = false,
  inverted = false,
}: {
  info: StoreInfo;
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  const logoUrl = storeAssetUrl(info.logoPath);

  return (
    <Link
      href="/"
      aria-label={`${info.name} — الصفحة الرئيسية`}
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span
        aria-hidden
        className="relative grid size-9 place-items-center overflow-hidden rounded-full border border-copper/40 transition-colors group-hover:border-copper"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={info.name}
            className="size-full rounded-full object-cover"
          />
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" fill="none">
            <path
              d="M12 3.5 15.2 9 21 10.2l-4.2 4.3 1 6.2L12 17.8 6.2 20.7l1-6.2L3 10.2 8.8 9Z"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-copper"
            />
          </svg>
        )}
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`text-[1.35rem] font-extrabold tracking-tight ${
            inverted ? "text-white" : "text-ink"
          }`}
        >
          {info.name}
        </span>
        {!compact && (
          <span
            className={`mt-1 text-[0.6rem] font-semibold tracking-[0.42em] ${
              inverted ? "text-white/45" : "text-ink-mute"
            }`}
          >
            {info.nameEn}
          </span>
        )}
      </span>
    </Link>
  );
}
