import type { TFunction } from "i18next";

/** Hero 只從同一語系的完整配對抽選，避免切換語言後標題與說明錯位。 */
export function storytellerPublicHomeCopies(t: TFunction) {
  return [0, 1, 2, 3].map((index) => ({
    title: t(`web.public.copies.${index}.title`),
    accent: t(`web.public.copies.${index}.accent`),
    lead: t(`web.public.copies.${index}.lead`),
  }));
}
