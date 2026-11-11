import type { AdUnit } from "@/components/common/promo/units.ts";

// joyu 的外部廣告設定：拿到廠商嵌入碼後填在這裡，改完重新部署前端即可。
// 嵌入網址會出現在前端 HTML 裡，不是機密，直接進 repo。

/** 總開關：關掉時全部版位都只放站內推廣 */
export const JOYU_ADS_ENABLED = true;

/** 版位名稱：首頁兩格、女優頁、影片頁 */
export const JOYU_AD_PLACEMENTS = [
  "home-1",
  "home-2",
  "actress",
  "video",
] as const;
export type JoyuAdPlacement = (typeof JOYU_AD_PLACEMENTS)[number];

/** 沒有個別設定的版位都用這組 */
const DEFAULT_UNITS: AdUnit[] = [
  // 範例（網址拿到後再填）：
  // {
  //   vendor: "adultforce",
  //   type: "iframe",
  //   src: { desktop: "https://…728x90…", mobile: "https://…300x100…" },
  //   weight: 1,
  // },
];

/** 個別版位要掛不同廣告時才加；沒列的版位用 DEFAULT_UNITS */
const PLACEMENT_UNITS: Partial<Record<JoyuAdPlacement, AdUnit[]>> = {};

export const joyuAdUnitsOf = (p: JoyuAdPlacement) =>
  PLACEMENT_UNITS[p] ?? DEFAULT_UNITS;
