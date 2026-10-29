import { Chip, Stack } from "@mui/material";
import { twStatsCategories } from "@/components/twstats/twStatsCategories.ts";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  // 有給數量時 chip 後面帶筆數，數量為 0 的分類停用
  total?: number;
  counts?: Map<string, number>;
};

/** 指標分類篩選；列表頁、縣市健檢、變化榜共用 */
export function TwStatsCategoryChips({
  value,
  onChange,
  total,
  counts,
}: Props) {
  const withCount = (label: string, count?: number) =>
    count === undefined ? label : `${label} ${count}`;
  return (
    <Stack direction={"row"} spacing={0.75} flexWrap={"wrap"} useFlexGap>
      <Chip
        label={withCount("全部", total)}
        color={value ? "default" : "primary"}
        variant={value ? "outlined" : "filled"}
        onClick={() => onChange(null)}
      />
      {twStatsCategories.map(({ id, label }) => (
        <Chip
          key={id}
          label={withCount(label, counts ? (counts.get(id) ?? 0) : undefined)}
          color={value === id ? "primary" : "default"}
          variant={value === id ? "filled" : "outlined"}
          disabled={counts !== undefined && !counts.get(id)}
          onClick={() => onChange(id)}
        />
      ))}
    </Stack>
  );
}
