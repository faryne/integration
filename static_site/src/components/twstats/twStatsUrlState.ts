import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";

// 網址參數：view=map／year=地圖年份／per=10k 每萬人／years=已選年份／areas=已選區域
// years 用區段壓縮（1998-2005,2010），選全部時兩者都省略，讓預設網址保持乾淨
export type TwStatsView = "line" | "map";

export const allTwAreas = Object.keys(TWAreaMappings) as TWArea[];

export const isTwStatsView = (value: string | null): value is TwStatsView =>
  value === "line" || value === "map";

export function encodeYears(selected: string[], all: string[]) {
  if (selected.length === all.length) {
    return null;
  }
  const numbers = selected.map(Number).sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < numbers.length; i += 1) {
    const start = numbers[i];
    while (numbers[i + 1] === numbers[i] + 1) {
      i += 1;
    }
    ranges.push(start === numbers[i] ? `${start}` : `${start}-${numbers[i]}`);
  }
  return ranges.join(",");
}

// 解析失敗或解析後與實際年份無交集時回傳 null，由呼叫端退回「全部年份」
export function decodeYears(value: string | null, all: string[]) {
  if (!value) {
    return null;
  }
  const wanted = new Set<string>();
  for (const part of value.split(",")) {
    const [from, to = from] = part.split("-").map(Number);
    for (let year = from; year <= to; year += 1) {
      wanted.add(String(year));
    }
  }
  const years = all.filter((year) => wanted.has(year));
  return years.length > 0 ? years : null;
}

export const encodeAreas = (selected: TWArea[]) =>
  selected.length === allTwAreas.length ? null : selected.join(",");

export function decodeAreas(value: string | null) {
  if (value === null) {
    return allTwAreas;
  }
  const wanted = new Set(value.split(","));
  return allTwAreas.filter((area) => wanted.has(area));
}
