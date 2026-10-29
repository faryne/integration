import type { TwStatsByYear } from "@/apis/opendata/twstats.ts";
import { parseStatValue } from "@/components/twstats/twStatsValue.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";

// 換算基準：戶籍登記人口數（單位：人），換算後一律呈現「每萬人」
export const populationIndicator = "戶籍登記人口數";
const perCapitaBase = 10000;

// 只有「數量／金額」類單位能換算；％、‰、人/十萬人 等本身已是比率或密度的不換算
const countUnits = new Set([
  "人",
  "千人",
  "人次",
  "戶",
  "對",
  "件",
  "千件",
  "次",
  "家",
  "家次",
  "所",
  "班",
  "個",
  "輛",
  "床",
  "具",
  "處",
  "間",
  "頭",
  "支",
  "時",
  "時段",
  "元",
  "千元",
  "百萬元",
  "公噸",
  "公頃",
  "公里",
  "平方公里",
  "平方公尺",
  "千平方公尺",
  "百萬度",
]);

// 單位是數量但名稱已含平均／每／率（例如「每百戶擁有數」）也排除，避免重複換算
export const canPerCapita = (name: string, unit?: string) =>
  !!unit &&
  countUnits.has(unit) &&
  name !== populationIndicator &&
  !/平均|每|率/.test(name);

const divide = (value?: string, population?: string) => {
  const numerator = parseStatValue(value);
  const denominator = parseStatValue(population);
  return numerator === null || !denominator
    ? "-"
    : ((numerator / denominator) * perCapitaBase).toFixed(2);
};

// 產生與原始資料同形狀的換算結果，下游的折線圖、表格、地圖都不用知道有沒有換算過
export function toPerCapita(
  data: TwStatsByYear,
  population: TwStatsByYear,
): TwStatsByYear {
  return Object.fromEntries(
    Object.entries(data).map(([year, row]) => {
      const populationRow = population[year];
      const areas = Object.fromEntries(
        (Object.keys(TWAreaMappings) as TWArea[]).map((area) => [
          area,
          divide(row[area], populationRow?.[area]),
        ]),
      );
      return [
        year,
        {
          ...row,
          ...areas,
          Total: divide(row.Total, populationRow?.Total),
          Unit: `${row.Unit}/萬人`,
        },
      ];
    }),
  );
}
