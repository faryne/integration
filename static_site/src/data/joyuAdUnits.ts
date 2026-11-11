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
// adultforce 的嵌入碼都是 a.adtng.com/get/<spot id>?ata=faryne 的 iframe（ata 是帳號代碼，原樣帶著）；
// 嵌入碼給的是 //a.adtng.com，這裡固定寫 https。
// 同一組 PC／手機各一個 spot；只有單一尺寸的 spot 只會在那個尺寸出現
const adtng = (spot: number) => `https://a.adtng.com/get/${spot}?ata=faryne`;

const DEFAULT_UNITS: AdUnit[] = [
  {
    vendor: "adultforce",
    type: "iframe",
    src: { desktop: adtng(10001811), mobile: adtng(10001817) },
  },
  {
    vendor: "adultforce",
    type: "iframe",
    src: { desktop: adtng(10002801), mobile: adtng(10002802) },
  },
  // 只有手機尺寸
  { vendor: "adultforce", type: "iframe", src: { mobile: adtng(10001814) } },
];

/** 個別版位要掛不同廣告時才加；沒列的版位用 DEFAULT_UNITS */
const PLACEMENT_UNITS: Partial<Record<JoyuAdPlacement, AdUnit[]>> = {};

export const joyuAdUnitsOf = (p: JoyuAdPlacement) =>
  PLACEMENT_UNITS[p] ?? DEFAULT_UNITS;
