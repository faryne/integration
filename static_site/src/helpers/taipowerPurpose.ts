import type {
  TaipowerPurposeKey,
  TaipowerPurposeStatistic,
} from "@/types/taipower.ts";

export const taipowerPurposeDetails: Record<
  TaipowerPurposeKey,
  { label: string; color: string }
> = {
  community: { label: "社區／節慶／藝文體育", color: "#2c8f82" },
  social_aid: { label: "社福／急難救助", color: "#66a88e" },
  education: { label: "教育／校園", color: "#86bdb3" },
  public_facilities: { label: "公共設施／環境", color: "#b0c9a2" },
  energy: { label: "節能／能源宣導", color: "#d4ba73" },
  unclassified: { label: "未分類", color: "#cdd5d2" },
};

export const taipowerPurposeKeys = Object.keys(
  taipowerPurposeDetails,
) as TaipowerPurposeKey[];

export interface PurposeGroup {
  key?: TaipowerPurposeKey;
  label: string;
  color: string;
  count: number;
  cash: number;
}

// 分類桶互斥；先合併指定範圍，再將少於 5 筆的類別併為展示用群組。
export function summarizeTaipowerPurposes(rows: TaipowerPurposeStatistic[]) {
  const raw = new Map<TaipowerPurposeKey, { count: number; cash: number }>();
  for (const row of rows) {
    const item = raw.get(row.purpose) ?? { count: 0, cash: 0 };
    item.count += row.count;
    item.cash += row.total_cash;
    raw.set(row.purpose, item);
  }
  const count = rows.reduce((total, row) => total + row.count, 0);
  const cash = rows.reduce((total, row) => total + row.total_cash, 0);
  const groups: PurposeGroup[] = [];
  let smallCount = 0;
  let smallCash = 0;
  for (const key of taipowerPurposeKeys) {
    const item = raw.get(key);
    if (!item?.count) continue;
    if (item.count < 5) {
      smallCount += item.count;
      smallCash += item.cash;
      continue;
    }
    groups.push({ key, ...taipowerPurposeDetails[key], ...item });
  }
  if (smallCount)
    groups.push({
      label: "少量案件（合併顯示）",
      color: "#9daaa5",
      count: smallCount,
      cash: smallCash,
    });
  groups.sort((a, b) => b.cash - a.cash);
  return {
    count,
    cash,
    unclassifiedCount: raw.get("unclassified")?.count ?? 0,
    groups,
  };
}
