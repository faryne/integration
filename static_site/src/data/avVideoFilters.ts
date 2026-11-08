import type { VideoTermKey } from "@/types/avVideoSubmission.ts";

// AV 影片搜尋的精確篩選：網址參數名稱 ↔ 顯示名稱，全部可複選（重複參數 ?maker=A&maker=B）。
// match：all 交集（出演＝同時出演、標籤＝全部符合），any 聯集（一部片通常只有一個發售商／品牌…，取交集一定沒結果）。
// field 是 autocomplete（/opendata/av/video/suggest）用的欄位名稱；詳細頁的 chip 也以 param 當 key 導到搜尋頁
export const AV_VIDEO_EXACT_FILTERS = [
  { param: "actress", label: "出演", field: "actresses", match: "all" },
  { param: "tag", label: "標籤", field: "tags", match: "all" },
  { param: "maker", label: "發售商", field: "makers", match: "any" },
  { param: "label", label: "品牌", field: "labels", match: "any" },
  { param: "series", label: "系列", field: "series", match: "any" },
  { param: "director", label: "監督", field: "directors", match: "any" },
] as const satisfies readonly {
  param: string;
  label: string;
  field: VideoTermKey;
  match: "all" | "any";
}[];

export type AVVideoExactFilterParam =
  (typeof AV_VIDEO_EXACT_FILTERS)[number]["param"];

// 表單欄位標題旁的多選說明：出演跟標籤雖然都是交集，講法不同
export const AV_VIDEO_MATCH_HINT: Record<AVVideoExactFilterParam, string> = {
  actress: "同時出演",
  tag: "全部符合",
  maker: "任一",
  label: "任一",
  series: "任一",
  director: "任一",
};

// 表單常駐的篩選；其餘收在「更多條件」
export const AV_VIDEO_PRIMARY_FILTERS: AVVideoExactFilterParam[] = [
  "actress",
  "tag",
];
