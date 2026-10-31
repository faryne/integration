import type { Actress } from "@/types/av.ts";

// xcity 沒照片時給的是自家的 noimage.gif，跟空字串一樣當成沒有照片
const NO_IMAGE_PATTERN = /noimage\.(gif|jpe?g|png)$/i;

/** 沒有可用的照片（空字串或 xcity 的 noimage） */
export function isMissingActressPhoto(photo?: string | null) {
  return !photo || NO_IMAGE_PATTERN.test(photo);
}

/** 生日：只有年也顯示，月日沒填就略過（例：2006、2006/7、2006/7/2） */
export function formatActressBirth(actress: Actress) {
  if (actress.birth_year <= 0) return "";
  return [actress.birth_year, actress.birth_month, actress.birth_day]
    .filter((v) => v > 0)
    .join("/");
}

/** 搜尋卡片的身形摘要：罩杯／B／W／H／身高，沒填的略過 */
export function formatActressBodyInfo(actress: Actress) {
  return [
    actress.cup && `${actress.cup} Cup`,
    actress.bust > 0 && `B${actress.bust}`,
    actress.waist > 0 && `W${actress.waist}`,
    actress.hips > 0 && `H${actress.hips}`,
    actress.height > 0 && `身高 ${actress.height}cm`,
  ]
    .filter(Boolean)
    .join(" / ");
}

/** 女優頁的三圍：「80B / 58 / 85」，沒填的位置顯示「-」；三圍都沒有時只剩罩杯 */
export function formatActressMeasurements(actress: Actress) {
  const sizes = [actress.bust, actress.waist, actress.hips];
  if (sizes.every((v) => !(v > 0)))
    return actress.cup ? `${actress.cup} Cup` : "";
  const [b, w, h] = sizes.map((v) => (v > 0 ? String(v) : "-"));
  return `${b}${actress.cup ?? ""} / ${w} / ${h}`;
}

/** 女優卡片的格線：手機 2 欄起跳；女優搜尋頁右側較窄，傳 lg 調整寬螢幕的欄數 */
export const actressCardGridSx = (lg = 4) => ({
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "repeat(2, minmax(0, 1fr))",
    sm: "repeat(3, minmax(0, 1fr))",
    lg: `repeat(${lg}, minmax(0, 1fr))`,
  },
});
