// AV 影片搜尋的精確篩選：網址參數名稱 ↔ 顯示名稱（單選）。
// 詳細頁的 chip 以 param 當 key 導到搜尋頁，搜尋頁再依同一份清單讀參數、顯示可移除的條件 chip
export const AV_VIDEO_EXACT_FILTERS = [
  { param: "maker", label: "發售商" },
  { param: "label", label: "品牌" },
  { param: "series", label: "系列" },
  { param: "director", label: "監督" },
  { param: "actress", label: "出演" },
] as const;

export type AVVideoExactFilterParam =
  (typeof AV_VIDEO_EXACT_FILTERS)[number]["param"];

// 標籤可以複選（?tag=A&tag=B，交集），跟上面的單選篩選分開處理
export const AV_VIDEO_TAG_LABEL = "標籤";
