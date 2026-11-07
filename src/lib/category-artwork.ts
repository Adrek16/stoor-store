import type { Category } from "./types";
import type { ArtworkKind } from "./types";

/**
 * شكل الرسم المناسب لبطاقة التصنيف.
 *
 * الروابط صارت رقمية (`perfumes-1`)، فلم يبقَ الاعتماد على الاسم الإنجليزي
 * للرابط. نستنتج الشكل من القسم الرئيسي ثم من كلمات الاسم/الاسم الإنجليزي،
 * حتى تظهر بطاقات الحقائب والإكسسوارات بأشكالها الصحيحة مهما تغيّر الرابط.
 */
export function categoryArtwork(category: Category): ArtworkKind {
  const haystack = `${category.name} ${category.nameEn}`.toLowerCase();

  if (category.parent === "bags") return "bag";
  if (category.parent === "perfumes") return "perfume";

  if (haystack.includes("حقيب") || haystack.includes("bag")) return "bag";
  if (haystack.includes("سلسل") || haystack.includes("necklace")) return "necklace";
  if (haystack.includes("قرط") || haystack.includes("earring")) return "earrings";
  if (haystack.includes("سوار") || haystack.includes("bracelet")) return "bracelet";
  if (haystack.includes("خاتم") || haystack.includes("ring")) return "ring";
  if (haystack.includes("طقم") || haystack.includes("set")) return "set";
  if (haystack.includes("ساعة") || haystack.includes("watch")) return "watch";
  if (haystack.includes("أكمام") || haystack.includes("cufflink")) return "cufflinks";

  return category.parent === "accessories" ? "necklace" : "perfume";
}

const TONES: Record<ArtworkKind, string> = {
  perfume: "#7a5c3e",
  necklace: "#d4a857",
  earrings: "#d9b98d",
  bracelet: "#d8a48f",
  ring: "#8b9499",
  set: "#c2a06b",
  watch: "#5a4433",
  cufflinks: "#4a4a4a",
  bag: "#9a6f4d",
};

/** لون هادئ مشتق من شكل البطاقة نفسها. */
export function categoryTone(category: Category): string {
  return TONES[categoryArtwork(category)];
}
