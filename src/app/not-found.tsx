import Link from "next/link";
import { categories } from "@/lib/categories";

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center justify-center py-24 text-center">
      <p className="num text-[5rem] font-extrabold leading-none text-copper/25">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm leading-7 text-ink-soft">
        ربما نُقل الرابط أو انتهت القطعة من المتجر. جرّب من أحد الأقسام:
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {categories.slice(0, 6).map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="rounded-full border border-line bg-white px-4 py-2 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:border-copper hover:text-copper-dark"
          >
            {c.name}
          </Link>
        ))}
      </div>
      <Link href="/" className="btn btn-primary mt-7">
        العودة للرئيسية
      </Link>
    </div>
  );
}
