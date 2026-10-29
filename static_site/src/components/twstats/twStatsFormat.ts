import { twStatsCategories } from "@/components/twstats/twStatsCategories.ts";

const categoryLabels = new Map(twStatsCategories.map((c) => [c.id, c.label]));

export const categoryLabel = (id: string) => categoryLabels.get(id) ?? "其他";

// 後端回傳 float64，整數照原樣、小數最多兩位
export const formatStat = (value: number) =>
  value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });

export const formatRate = (rate: number) =>
  `${rate > 0 ? "+" : ""}${rate.toLocaleString("zh-TW", { maximumFractionDigits: 1 })}%`;

// 指標頁連結：直接開地圖並停在該年度；數量類指標一併開啟每萬人換算，和名次的比較基準一致
export const indicatorMapLink = (
  name: string,
  year: number,
  perCapita: boolean,
) =>
  `/data/tw-stats/${encodeURIComponent(name)}?view=map&year=${year}${perCapita ? "&per=10k" : ""}`;

export const areaProfileLink = (code: string) => `/data/tw-stats/area/${code}`;
