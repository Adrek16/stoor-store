import Link from "next/link";
import { ChevronIcon } from "./icons";

export default function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "عرض الكل",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[1.7rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-xl text-[0.86rem] leading-6 text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group hidden shrink-0 items-center gap-1 text-[0.8rem] font-bold text-ink-soft transition-colors hover:text-copper-dark sm:flex"
        >
          {linkLabel}
          <ChevronIcon className="size-4 transition-transform group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  );
}
