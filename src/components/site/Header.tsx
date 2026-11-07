"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { useCart } from "@/components/cart/CartProvider";
import {
  CartIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import type { StoreInfo } from "@/lib/store-info";
import type { Category } from "@/lib/types";

export default function Header({
  categories,
  info,
}: {
  categories: Category[];
  info: StoreInfo;
}) {
  const { count, open } = useCart();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const waNumber = info.whatsapp.replace(/\D/g, "");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // قفل تمرير الصفحة أثناء فتح القائمة الجانبية.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
    <header
      className={`sticky top-0 z-50 border-b bg-cream/85 backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "border-line shadow-[0_8px_30px_-24px_rgba(35,29,27,0.7)]" : "border-transparent"
      }`}
    >
      <div className="container-x">
        <div className="flex h-16 items-center justify-between gap-2 md:h-20">
          {/* start (right in RTL) */}
          <div className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sand lg:hidden"
              aria-label="فتح القائمة"
            >
              <MenuIcon />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="hidden size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sand lg:grid"
              aria-label="بحث"
            >
              <SearchIcon />
            </button>
          </div>

          <Logo info={info} className="shrink-0" />

          {/* end (left in RTL) */}
          <div className="flex flex-1 items-center justify-end gap-1">
            <Link
              href="/search"
              className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sand lg:hidden"
              aria-label="بحث"
            >
              <SearchIcon />
            </Link>
            <Link
              href="/account"
              className="hidden size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sand sm:grid"
              aria-label="حسابي"
            >
              <UserIcon />
            </Link>
            <button
              type="button"
              onClick={open}
              className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sand"
              aria-label={`السلة — ${count} منتج`}
            >
              <CartIcon />
              {count > 0 && (
                <span className="num absolute -top-0.5 -left-0.5 grid min-w-5 place-items-center rounded-full bg-copper px-1 text-[0.65rem] font-bold leading-5 text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop category rail */}
        <nav className="hidden items-center justify-center gap-7 pb-3 lg:flex">
          {categories.slice(0, 9).map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group relative py-1 text-[0.82rem] font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              {c.name}
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-copper transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Search panel ───────────────────────────── */}
      <div
        className={`overflow-hidden border-line bg-cream transition-[max-height,opacity] duration-300 ${
          searchOpen ? "max-h-24 border-t opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <form onSubmit={submitSearch} className="container-x flex items-center gap-3 py-4">
          <SearchIcon className="size-5 shrink-0 text-ink-mute" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ابحث عن عطر، سلسلة، حقيبة…"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-mute"
          />
          <button type="submit" className="btn btn-primary !px-5 !py-2 text-xs">
            بحث
          </button>
        </form>
      </div>
    </header>

      {/* ── Mobile drawer ──────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden lg:hidden ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التصنيفات"
          className={`absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-cream shadow-2xl transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Logo info={info} compact />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid size-9 place-items-center rounded-full hover:bg-sand"
              aria-label="إغلاق"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <p className="eyebrow mb-3">تسوّق حسب التصنيف</p>
            <ul className="space-y-1">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:bg-sand"
                  >
                    {c.name}
                    <span className="text-xs font-normal text-ink-mute">{c.nameEn}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="my-5 hairline" />

            <ul className="space-y-1 text-sm text-ink-soft">
              <li>
                <Link href="/about" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-sand">
                  نبذة عنا
                </Link>
              </li>
              <li>
                <Link href="/shipping" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-sand">
                  الاستلام من المتجر
                </Link>
              </li>
              <li>
                <Link href="/returns" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-sand">
                  الاستبدال والاسترجاع
                </Link>
              </li>
              <li>
                <Link href="/contact" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-sand">
                  تواصل معنا
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-line px-5 py-4">
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-copper w-full"
            >
              اطلب عبر واتساب
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
