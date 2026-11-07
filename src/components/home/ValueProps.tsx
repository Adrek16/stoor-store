import { LockIcon, ReturnIcon, ShieldIcon, StoreIcon } from "@/components/icons";
import type { StoreInfo } from "@/lib/store-info";

/**
 * مزايا المتجر — بلا وعود شحن أو توصيل.
 * أول بند يقرأ العنوان الفعلي من معلومات المتجر.
 */
export default function ValueProps({ info }: { info: StoreInfo }) {
  const items = [
    {
      icon: StoreIcon,
      title: "الاستلام من المتجر",
      body: info.address || "حسب عنوان المتجر",
    },
    {
      icon: ShieldIcon,
      title: "منتجات أصلية",
      body: "فحص جودة لكل قطعة",
    },
    {
      icon: ReturnIcon,
      title: "استبدال 14 يوم",
      body: "بدون أسئلة معقّدة",
    },
    {
      icon: LockIcon,
      title: "الدفع عند الاستلام",
      body: "ادفع عند استلام طلبك",
    },
  ];

  return (
    <section className="border-y border-line bg-white">
      <div className="container-x grid grid-cols-2 gap-x-4 gap-y-5 py-6 md:grid-cols-4 md:py-5">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand text-copper-dark">
              <Icon className="size-[1.15rem]" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.82rem] font-bold text-ink">{title}</p>
              <p className="truncate text-[0.72rem] text-ink-mute">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
