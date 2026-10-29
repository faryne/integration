import type { TwStatsAreaIndicator } from "@/types/twstats.ts";

const highlightSize = 10;
const minRankTotal = 15;
const perCategoryLimit = 2;

// 縣市健檢的「最高／最低 10 項」挑選規則：
// 1. 只看近兩年有資料、且至少 15 縣市有值的指標，排除停更的舊指標與只有少數縣市的指標
// 2. 同一分類最多 2 項：大城市在上百個指標都是第 1 名，不限制的話會整排都是同一類的細項
export function pickHighlights(
  indicators: TwStatsAreaIndicator[],
  side: "top" | "bottom",
) {
  const recentYear = Math.max(...indicators.map((i) => i.year));
  // 名次換算成「距離端點幾名」：top 看離第 1 名多遠，bottom 看離最後一名多遠
  const distance = (i: TwStatsAreaIndicator) =>
    side === "top" ? i.rank - 1 : i.rank_total - i.rank;
  const pool = indicators
    .filter((i) => i.year >= recentYear - 1 && i.rank_total >= minRankTotal)
    .sort((a, b) => distance(a) - distance(b) || b.rank_total - a.rank_total);

  const perCategory = new Map<string, number>();
  return pool
    .filter((i) => {
      const used = perCategory.get(i.category) ?? 0;
      perCategory.set(i.category, used + 1);
      return used < perCategoryLimit;
    })
    .slice(0, highlightSize);
}
