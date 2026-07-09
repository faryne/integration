import type { BgColorValue, TextColorValue } from "./whitelist";

/**
 * 文字顏色「值 → 實際樣式」的固定對照表。
 *
 * 這是「不開放使用者自填 CSS」這條安全性規則的落地：序列化字串裡只會出現色盤裡的
 * enum 值（red／yellow…），實際的色碼永遠由這份程式碼控制的對照表決定，渲染端（編輯區
 * 用 class、閱讀頁用 inline style）都從這裡查，不會把使用者可控字串塞進 style 屬性。
 */

/** 前景色：飽和度高、對比明顯的語意色。 */
export const TEXT_COLOR_CSS: Record<TextColorValue, string> = {
  red: "#d32f2f",
  orange: "#ed6c02",
  green: "#2e7d32",
  blue: "#1565c0",
  purple: "#7b1fa2",
};

/** 背景色：偏淡，文字疊上去仍然讀得到（比照 commentColor 的淡色路線）。 */
export const BG_COLOR_CSS: Record<BgColorValue, string> = {
  yellow: "rgba(255, 214, 0, 0.35)",
  pink: "rgba(236, 64, 122, 0.25)",
  blue: "rgba(66, 165, 245, 0.28)",
  green: "rgba(102, 187, 106, 0.28)",
  purple: "rgba(171, 71, 188, 0.25)",
};

export const TEXT_COLOR_LABELS: Record<TextColorValue, string> = {
  red: "紅",
  orange: "橘",
  green: "綠",
  blue: "藍",
  purple: "紫",
};

export const BG_COLOR_LABELS: Record<BgColorValue, string> = {
  yellow: "黃",
  pink: "粉紅",
  blue: "藍",
  green: "綠",
  purple: "紫",
};
