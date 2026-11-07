import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronIcon, WhatsAppIcon } from "@/components/icons";
import { DEFAULT_STORE_INFO, getStoreInfo, type StoreInfo } from "@/lib/store-info";

type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "steps"; items: { title: string; body: string }[] };

type Page = { title: string; eyebrow: string; intro: string; blocks: Block[] };

/**
 * صفحات المعلومات الثابتة.
 *
 * الصفحات التي تعرض بيانات المتجر (الهاتف/العنوان/ساعات العمل) تُبنى
 * كدوال تأخذ `StoreInfo`، حتى تظهر قيم لوحة المدير لا نصوصاً مكتوبة هنا.
 */
function buildPages(info: StoreInfo): Record<string, Page> {
  return {
  about: {
    title: "نبذة عنا",
    eyebrow: "من نحن",
    intro:
      info.about ||
      `${info.name} متجر يمني متخصص في العطور والإكسسوارات — للرجال والنساء.`,
    blocks: [
      { type: "h", text: `لماذا ${info.name}؟` },
      { type: "p", text: info.description },
      { type: "ul", items: [
        "عطور بتركيز 15–24%، لا مخفّفة",
        "إكسسوارات ستانلس ستيل ومطليّة ذهب 18 قيراط",
        "فحص جودة لكل قطعة قبل التسليم",
      ]},
      { type: "h", text: "كيف نعمل" },
      { type: "p", text: "نستورد من موردين مختارين في الإمارات وتركيا وفرنسا، ونخزّن قطعنا في مستودعنا. الطلبات تُجهّز ويصلك تنبيه عند جاهزيتها للاستلام من المتجر." },
      { type: "h", text: "الاستلام من المتجر" },
      { type: "p", text: `عنوان المتجر: ${info.address}. ساعات العمل: ${info.workingHours}.` },
    ],
  },
  contact: {
    title: "تواصل معنا",
    eyebrow: "خدمة العملاء",
    intro: `نجيب خلال ساعات العمل: ${info.workingHours}.`,
    blocks: [
      { type: "ul", items: [
        `واتساب: ${info.whatsapp || info.phone}`,
        `الهاتف: ${info.phone}`,
        `البريد: ${info.email}`,
        `العنوان: ${info.address}`,
      ]},
      { type: "h", text: "قبل أن تراسلنا" },
      { type: "p", text: "إن كان استفسارك عن طلب حالي، أرسل رقم الطلب في أول رسالة ليصل الرد أسرع." },
    ],
  },
  shipping: {
    title: "الاستلام من المتجر",
    eyebrow: "الاستلام",
    intro: "لا نقدّم الشحن والتوصيل — طلبك يُستلم من المتجر أو يُرتَّب معك عبر واتساب.",
    blocks: [
      { type: "h", text: "كيف تستلم طلبك؟" },
      { type: "ul", items: [
        `أكمل الطلب من الموقع، ثم نتواصل معك على واتساب لتحديد موعد الاستلام`,
        `العنوان: ${info.address}`,
        `ساعات العمل: ${info.workingHours}`,
        "أحضر رقم الطلب معك — أو أرسله على واتساب لتأكيد الحالة",
        "لا توجد رسوم إضافية على الطلب",
      ]},
      { type: "h", text: "الدفع" },
      { type: "ul", items: [
        "الدفع عند الاستلام في المتجر",
        "أو تحويل بنكي / محفظة محلية: تظهر البيانات عند إتمام الطلب، ثم ترفع صورة الإيصال ليعتمدها المدير",
      ]},
      { type: "h", text: "إن تعذّر الاستلام" },
      { type: "p", text: "راسلنا على واتساب برقم طلبك ونرتّب معك موعداً آخر. الطلبات غير المستلمة تُلغى بعد مدة التواصل المتفق عليها ويُعاد المبلغ كاملاً." },
    ],
  },
  returns: {
    title: "الاستبدال والاسترجاع",
    eyebrow: "السياسات",
    intro: "لديك 14 يوماً من تاريخ الاستلام للاستبدال أو الاسترجاع.",
    blocks: [
      { type: "h", text: "الشروط" },
      { type: "ul", items: [
        "القطعة بحالتها الأصلية وبتغليفها",
        "إرفاق فاتورة الطلب أو رقمه",
        "العطور المفتوحة غير قابلة للاسترجاع لأسباب صحية",
        "الأقراط غير قابلة للاسترجاع لأسباب صحية",
      ]},
      { type: "h", text: "الخطوات" },
      { type: "steps", items: [
        { title: "راسلنا", body: "أرسل رقم الطلب وصورة للقطعة على واتساب." },
        { title: "الموافقة", body: "نؤكد الأهلية خلال 24 ساعة ونرتّب معك الاستبدال في المتجر." },
        { title: "الإرجاع", body: "بعد استلام القطعة وسلامتها، يُعاد المبلغ خلال 3–5 أيام عمل." },
      ]},
    ],
  },
  faq: {
    title: "الأسئلة الشائعة",
    eyebrow: "مساعدة",
    intro: "أكثر ما يُسأل عنه — وإن لم تجد إجابتك، راسلنا على واتساب.",
    blocks: [
      { type: "h", text: "هل العطور أصلية؟" },
      { type: "p", text: "نعم. جميع عطورنا من موردين معتمدين، ونفحص كل دفعة قبل الإضافة للمتجر." },
      { type: "h", text: "كم يدوم ثبات العطر؟" },
      { type: "p", text: "من 5 إلى 12 ساعة حسب التركيز ونوع البشرة. كل صفحة منتج تذكر الثبات المتوقع." },
      { type: "h", text: "كيف أستلم طلبي؟" },
      { type: "p", text: `الطلب يُستلم من المتجر — ${info.address}. نتواصل معك على واتساب بعد التأكيد لتحديد الموعد. ساعات العمل: ${info.workingHours}.` },
      { type: "h", text: "كيف أدفع بالتحويل البنكي؟" },
      { type: "p", text: "اختر «تحويل بنكي» عند إتمام الطلب، ستظهر لك بيانات الحساب. حوّل المبلغ ثم ارفع صورة الإيصال من صفحة الطلب؛ يعتمده المدير خلال ساعات العمل. إن لم يُعتمد الإيصال خلال 3 أيام يُلغى الطلب تلقائياً." },
    ],
  },
  care: {
    title: "دليل العناية بالقطع",
    eyebrow: "العناية",
    intro: "خطوات بسيطة تطيل عمر الإكسسوارات وتحافظ على لمعانها.",
    blocks: [
      { type: "ul", items: [
        "اخلع القطع قبل السباحة أو الاستحمام",
        "تجنّب العطور والكريمات مباشرة على المعدن",
        "امسحها بقطعة قماش ناعمة جافة بعد الاستخدام",
        "خزّنها في كيس مستقل بعيداً عن الرطوبة",
      ]},
      { type: "h", text: "العطور" },
      { type: "p", text: "احفظ الزجاجة بعيداً عن الشمس والحرارة. الرشّ على الملابس قد يترك أثراً على الأقمشة الفاتحة." },
    ],
  },
  blog: {
    title: "المدونة",
    eyebrow: "مقالات",
    intro: "دليل مختصر لاختيار العطر المناسب، والعناية بالقطع المعدنية.",
    blocks: [
      { type: "h", text: "كيف تختار عطرك الأول؟" },
      { type: "p", text: "ابدأ من العائلة العطرية: خشبية للمساء، حمضية للنهار، شرقية للمناسبات. جرّب على البشرة لا على الورقة، وانتظر 20 دقيقة قبل الحكم." },
      { type: "h", text: "الفرق بين EDT و EDP" },
      { type: "p", text: "أو دو تواليت تركيزه 8–12% وثباته أقصر، وأو دو بارفان 15–20% وأثقل. للصيف والنهار: تواليت. للمساء والشتاء: بارفان." },
    ],
  },
  privacy: {
    title: "سياسة الخصوصية",
    eyebrow: "قانوني",
    intro: "نحترم بياناتك ولا نبيعها لأي طرف ثالث.",
    blocks: [
      { type: "h", text: "ما نجمعه" },
      { type: "ul", items: [
        "الاسم ورقم الجوال والعنوان لتنفيذ الطلب",
        "البريد الإلكتروني إن اخترت الاشتراك بالنشرة",
        "بيانات تصفّح مجهولة لتحسين التجربة",
      ]},
      { type: "h", text: "حقوقك" },
      { type: "p", text: "يمكنك طلب حذف بياناتك في أي وقت عبر مراسلتنا، وسننفّذ الطلب خلال 7 أيام عمل." },
    ],
  },
  terms: {
    title: "الشروط والأحكام",
    eyebrow: "قانوني",
    intro: "باستخدامك المتجر فإنك توافق على الشروط التالية.",
    blocks: [
      { type: "ul", items: [
        "الأسعار بالريال اليمني ولا توجد رسوم إضافية",
        "نحتفظ بحق إلغاء أي طلب في حال نقص المخزون مع إعادة المبلغ كاملاً",
        "الصور توضيحية وقد تختلف تفاصيل بسيطة عن المنتج الفعلي",
        "الاستخدام التجاري لمحتوى المتجر غير مسموح دون إذن",
      ]},
    ],
  },
  account: {
    title: "حسابي",
    eyebrow: "حسابك",
    intro: "تسجيل الدخول وتتبّع الطلبات سيُضاف في المرحلة القادمة من التطوير.",
    blocks: [
      { type: "p", text: "حالياً يمكنك إتمام الطلب كزائر. لحفظ بياناتك وتتبّع طلباتك من مكان واحد، انتظر إطلاق الحسابات." },
      { type: "ul", items: [
        "تتبّع الطلبات — قريباً",
        "قائمة المفضلة — قريباً",
        "بيانات التواصل المحفوظة — قريباً",
      ]},
    ],
  },
  };
}

/** صفحات بتواريخ ثابتة — لا تعتمد على بيانات المتجر. */
const STATIC_SLUGS = Object.keys(buildPages(DEFAULT_STORE_INFO));

export function generateStaticParams() {
  return STATIC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const info = await getStoreInfo();
  const page = buildPages(info)[slug];
  return page ? { title: page.title, description: page.intro } : { title: "صفحة غير موجودة" };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getStoreInfo();
  const pages = buildPages(info);
  const page = pages[slug];
  if (!page) notFound();

  return (
    <div className="container-x py-10">
      <nav className="mb-5 flex items-center gap-1.5 text-[0.72rem] text-ink-mute">
        <Link href="/" className="hover:text-copper-dark">الرئيسية</Link>
        <ChevronIcon className="size-3" />
        <span className="font-semibold text-ink">{page.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
        <article className="max-w-2xl">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink sm:text-4xl">{page.title}</h1>
          <p className="mt-3 text-[0.95rem] leading-8 text-ink-soft">{page.intro}</p>

          <div className="mt-8 space-y-5">
            {page.blocks.map((b, i) => {
              if (b.type === "h")
                return (
                  <h2 key={i} className="pt-2 text-lg font-extrabold text-ink">
                    {b.text}
                  </h2>
                );
              if (b.type === "p")
                return (
                  <p key={i} className="text-[0.9rem] leading-8 text-ink-soft">
                    {b.text}
                  </p>
                );
              if (b.type === "ul")
                return (
                  <ul key={i} className="space-y-2">
                    {b.items.map((it) => (
                      <li key={it} className="flex gap-2.5 text-[0.9rem] leading-7 text-ink-soft">
                        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-copper" />
                        {it}
                      </li>
                    ))}
                  </ul>
                );
              return (
                <ol key={i} className="space-y-3">
                  {b.items.map((it, idx) => (
                    <li key={it.title} className="flex gap-3 rounded-xl border border-line-soft bg-white p-4">
                      <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-sand text-[0.72rem] font-bold text-copper-dark">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-[0.86rem] font-bold text-ink">{it.title}</p>
                        <p className="mt-0.5 text-[0.82rem] leading-6 text-ink-soft">{it.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              );
            })}
          </div>
        </article>

        <aside className="rounded-2xl border border-line-soft bg-white p-5 lg:sticky lg:top-24">
          <p className="text-sm font-extrabold text-ink">تحتاج مساعدة؟</p>
          <p className="mt-1.5 text-[0.8rem] leading-6 text-ink-soft">
            فريقنا يجيب على واتساب: {info.workingHours}.
          </p>
          <a
            href={`https://wa.me/${info.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-copper mt-4 w-full"
          >
            <WhatsAppIcon className="size-4" />
            راسلنا
          </a>
          <div className="mt-4 space-y-1.5 text-[0.76rem]">
            <Link href="/shipping" className="block text-ink-soft hover:text-copper-dark">
              الاستلام من المتجر
            </Link>
            <Link href="/returns" className="block text-ink-soft hover:text-copper-dark">
              الاستبدال والاسترجاع
            </Link>
            <Link href="/faq" className="block text-ink-soft hover:text-copper-dark">
              الأسئلة الشائعة
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
