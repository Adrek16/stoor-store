import type { Metadata } from "next";
import "./globals.css";

import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import AnnouncementBar from "@/components/site/AnnouncementBar";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import WhatsAppFab from "@/components/site/WhatsAppFab";
import { site } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { getStoreInfo } from "@/lib/store-info";
import type { CartProduct } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const info = await getStoreInfo();
  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${info.name} — ${info.tagline}`,
      template: `%s | ${info.name}`,
    },
    description: info.description,
    keywords: [
      "عطور رجالية",
      "عطور نسائية",
      "إكسسوارات",
      "سلاسل",
      "أقراط",
      "ساعات",
      "متجر عطور",
    ],
    openGraph: {
      type: "website",
      locale: "ar_SA",
      siteName: info.name,
      title: `${info.name} — ${info.tagline}`,
      description: info.description,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { products, categories } = await getCatalog();
  const info = await getStoreInfo();

  // السلة تحتاج السعر والاسم والرسم فقط — لا نرسل الكتالوج كاملاً للمتصفح.
  const cartCatalog: CartProduct[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    price: p.price,
    compareAt: p.compareAt,
    artwork: p.artwork,
    tone: p.tone,
    options: p.options,
    colors: p.colors,
    stock: p.stock,
  }));

  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/cairo-arabic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cairo-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col bg-cream">
        <CartProvider catalog={cartCatalog}>
          <AnnouncementBar info={info} />
          <Header categories={categories} info={info} />
          <main className="flex-1">{children}</main>
          <Footer categories={categories} info={info} />
          <CartDrawer />
          <WhatsAppFab info={info} />
        </CartProvider>
      </body>
    </html>
  );
}
