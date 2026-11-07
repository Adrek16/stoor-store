"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { CartProduct } from "@/lib/types";

/**
 * سلة العميل المسجّل — مصدرها الخادم.
 *
 * - لا سلة للزائر: أي إضافة تحوّله إلى `/account?next=…`.
 * - كل عميل له سلة واحدة في `customer_carts` تتبعه على أجهزته.
 * - لا تحجز مخزوناً ولا تخصم منه — مجرد نوايا شراء.
 * - السلة المحلية القديمة تُدمج مرة واحدة ثم تُمسح.
 */

export type CartLine = {
  key: string;
  productId: string;
  qty: number;
  option?: string;
  color?: string;
};

export type HydratedLine = CartLine & { product: CartProduct };

type ServerLine = {
  productId: string;
  qty: number;
  option?: string;
  color?: string;
};

type CartContextValue = {
  lines: CartLine[];
  detailed: HydratedLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  ready: boolean;
  authenticated: boolean;
  add: (
    productId: string,
    opts?: { qty?: number; option?: string; color?: string }
  ) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** مفتاح السلة المحلية القديمة — يُدمج مرة واحدة ثم يُمسح. */
const LEGACY_STORAGE_KEY = "stoor.cart.v1";
// مفتاح قديم لِكوبون أُلغي — نمسحه من المتصفح مرة واحدة حتى لا يبقى أثر للكوبونات.
const LEGACY_COUPON_KEY = "stoor.coupon.v1";

const lineKey = (productId: string, option?: string, color?: string) =>
  [productId, option ?? "", color ?? ""].join("::");

function toLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((line): line is ServerLine => Boolean(line) && typeof line.productId === "string")
    .map((line) => ({
      key: lineKey(line.productId, line.option, line.color),
      productId: line.productId,
      qty: Math.min(Math.max(Number(line.qty) || 0, 1), 20),
      option: line.option || undefined,
      color: line.color || undefined,
    }))
    .filter((line) => line.qty > 0);
}

async function readServerCart(): Promise<{ status: number; lines: CartLine[] }> {
  const res = await fetch("/api/account/cart", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return {
    status: res.status,
    lines: res.ok && data?.ok ? toLines(data.lines) : [],
  };
}

export function CartProvider({
  children,
  catalog,
}: {
  children: React.ReactNode;
  /** لقطة مختصرة من الكتالوج تُمرَّر من الخادم (الأسعار والأسماء فقط). */
  catalog: CartProduct[];
}) {
  const router = useRouter();

  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const mergingLegacy = useRef(false);

  const goLogin = useCallback(() => {
    // المسار يُقرأ وقت النقر فقط — لا نستخدم usePathname حتى لا نمنع
    // توليد الصفحة مسبقاً (Next 16 / Cache Components).
    const current =
      typeof window === "undefined" ? "/" : window.location.pathname || "/";
    const next = encodeURIComponent(current);
    router.push(`/account?next=${next}`);
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      const result = await readServerCart();
      if (result.status === 401) {
        setAuthenticated(false);
        setLines([]);
        return;
      }
      setAuthenticated(true);
      setLines(result.lines);
    } catch {
      /* الشبكة غير متاحة — نُبقي ما في الذاكرة */
    }
  }, []);

  /** دمج السلة المحلية القديمة مرة واحدة بعد أول دخول. */
  const mergeLegacyCart = useCallback(async () => {
    if (mergingLegacy.current) return;
    let legacy: unknown = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null");
    } catch {
      legacy = null;
    }

    if (!Array.isArray(legacy) || legacy.length === 0) {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    mergingLegacy.current = true;
    try {
      for (const raw of legacy as ServerLine[]) {
        if (!raw || typeof raw.productId !== "string") continue;
        await fetch("/api/account/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: raw.productId,
            qty: Number(raw.qty) || 1,
            option: raw.option,
            color: raw.color,
          }),
        }).catch(() => null);
      }
      const result = await readServerCart();
      if (result.status !== 401) setLines(result.lines);
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } finally {
      mergingLegacy.current = false;
    }
  }, []);

  // تحميل السلة من الخادم مرة واحدة عند التحميل.
  useEffect(() => {
    let alive = true;

    try {
      localStorage.removeItem(LEGACY_COUPON_KEY);
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const result = await readServerCart();
        if (!alive) return;
        if (result.status === 401) {
          setAuthenticated(false);
          setLines([]);
          return;
        }
        setAuthenticated(true);
        setLines(result.lines);
        await mergeLegacyCart();
      } catch {
        /* offline — تبقى السلة فارغة حتى تتصل */
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mergeLegacyCart]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const add = useCallback<CartContextValue["add"]>(
    (productId, opts = {}) => {
      if (!authenticated) {
        goLogin();
        return;
      }

      const { qty = 1, option, color } = opts;
      const key = lineKey(productId, option, color);

      // تحديث تفاؤلي فوري ثم مزامنة مع الخادم.
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) =>
            l.key === key ? { ...l, qty: Math.min(l.qty + qty, 20) } : l
          );
        }
        return [...prev, { key, productId, qty: Math.min(qty, 20), option, color }];
      });
      setIsOpen(true);

      fetch("/api/account/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, qty, option, color }),
      })
        .then(async (res) => {
          if (res.status === 401) {
            setAuthenticated(false);
            goLogin();
            return;
          }
          const data = await res.json().catch(() => null);
          if (res.ok && data?.ok) setLines(toLines(data.lines));
          else void refresh();
        })
        .catch(() => void refresh());
    },
    [authenticated, goLogin, refresh]
  );

  const remove = useCallback(
    (key: string) => {
      const target = lines.find((l) => l.key === key);
      setLines((prev) => prev.filter((l) => l.key !== key));
      if (!target) return;

      const params = new URLSearchParams({
        productId: target.productId,
        option: target.option ?? "",
        color: target.color ?? "",
      });
      fetch(`/api/account/cart?${params.toString()}`, { method: "DELETE" })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (res.ok && data?.ok) setLines(toLines(data.lines));
        })
        .catch(() => void refresh());
    },
    [lines, refresh]
  );

  const setQty = useCallback(
    (key: string, qty: number) => {
      const target = lines.find((l) => l.key === key);
      if (!target) return;

      if (qty <= 0) {
        remove(key);
        return;
      }

      const nextQty = Math.min(qty, 20);
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, qty: nextQty } : l))
      );

      fetch("/api/account/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: target.productId,
          option: target.option,
          color: target.color,
          qty: nextQty,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (res.ok && data?.ok) setLines(toLines(data.lines));
        })
        .catch(() => void refresh());
    },
    [lines, remove, refresh]
  );

  const clear = useCallback(() => {
    setLines([]);
    if (!authenticated) return;
    fetch("/api/account/cart", { method: "DELETE" }).catch(() => void refresh());
  }, [authenticated, refresh]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const detailed = useMemo(
    () =>
      lines
        .map((l) => {
          const product = catalog.find((p) => p.id === l.productId);
          return product ? { ...l, product } : null;
        })
        .filter((l): l is HydratedLine => l !== null),
    [lines, catalog]
  );

  const count = useMemo(
    () => detailed.reduce((sum, l) => sum + l.qty, 0),
    [detailed]
  );

  const subtotal = useMemo(
    () => detailed.reduce((sum, l) => sum + l.product.price * l.qty, 0),
    [detailed]
  );

  const value: CartContextValue = {
    lines,
    detailed,
    count,
    subtotal,
    isOpen,
    ready,
    authenticated,
    add,
    remove,
    setQty,
    clear,
    open,
    close,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
