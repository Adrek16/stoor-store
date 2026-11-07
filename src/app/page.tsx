import Hero from "@/components/home/Hero";
import ValueProps from "@/components/home/ValueProps";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import GenderSplit from "@/components/home/GenderSplit";
import Testimonials from "@/components/home/Testimonials";
import Newsletter from "@/components/home/Newsletter";
import { bestSellers, curatedPicks, newArrivals } from "@/lib/catalog-ops";
import { getCatalog } from "@/lib/catalog";
import { getStoreInfo } from "@/lib/store-info";
import { site } from "@/lib/site";

export default async function HomePage() {
  const [{ products, categories }, info] = await Promise.all([
    getCatalog(),
    getStoreInfo(),
  ]);
  const women = products.filter((p) => p.gender === "women");
  const men = products.filter((p) => p.gender === "men");

  // «الأكثر مبيعاً» من الطلبات المؤكدة فقط. إن لم توجد مبيعات بعد،
  // نعرض اختيارات تحريرية تحت عنوان «مختارة بعناية» بدل ادعاء مبيعات.
  const realBestSellers = bestSellers(products, 4);
  const hasRealSales = realBestSellers.length > 0;
  const featured = hasRealSales ? realBestSellers : curatedPicks(products, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: info.name,
    description: info.description,
    url: site.url,
    currenciesAccepted: "YER",
    paymentAccepted: "ByBankTransferInAdvance, CashOnDelivery",
    address: info.address
      ? { "@type": "PostalAddress", streetAddress: info.address }
      : undefined,
    telephone: info.phone || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero info={info} />
      <ValueProps info={info} />
      <CategoryGrid categories={categories} />

      <ProductSection
        eyebrow={hasRealSales ? "الأكثر مبيعاً" : "مختارة بعناية"}
        title={
          hasRealSales
            ? "القطع التي يعود لها العملاء"
            : "قطع اختارها فريق ستور"
        }
        description={
          hasRealSales
            ? "اختيارات عملائنا الأكثر طلباً — مبنية على الطلبات المؤكدة فعلياً."
            : "ترشيحات تحريرية من الكتالوج — ستُستبدل تلقائياً بالأكثر مبيعاً عند تأكيد أول الطلبات."
        }
        href="/category/women-perfumes"
        products={featured}
        limit={4}
        tone="white"
      />

      <GenderSplit />

      <ProductSection
        id="new"
        eyebrow="وصل حديثاً"
        title="إصدارات هذا الموسم"
        description="كميات محدودة من العطور والإكسسوارات الجديدة."
        href="/categories"
        products={newArrivals(products)}
        limit={4}
      />

      <ProductSection
        eyebrow="للرجال"
        title="عطور وإكسسوارات رجالية"
        description="حضور هادئ وتفاصيل مدروسة — من العود إلى الساعة الكلاسيكية."
        href="/category/men-perfumes"
        products={men}
        limit={4}
        tone="white"
      />

      <ProductSection
        id="women"
        eyebrow="للنساء"
        title="عطور وإكسسوارات نسائية"
        description="قطع ناعمة تكمل الإطلالة اليومية والمناسبات."
        href="/category/women-perfumes"
        products={women}
        limit={4}
      />

      <Testimonials />

      <Newsletter />
    </>
  );
}
