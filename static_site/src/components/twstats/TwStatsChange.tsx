import { Typography } from "@mui/material";
import { formatRate } from "@/components/twstats/twStatsFormat.ts";

// 漲跌不上紅綠：指標有好有壞（例如犯罪率上升），顏色暗示好壞反而誤導，只用箭頭表示方向

/** 年增率：▲ +12.3% / ▼ -4.5%，無資料顯示 - */
export function TwStatsChangeRate({ rate }: { rate?: number }) {
  if (rate === undefined) {
    return <Typography variant={"body2"}>-</Typography>;
  }
  // 先四捨五入到顯示精度再判斷方向，避免 +0.01% 顯示成「▲ +0%」
  const rounded = Math.round(rate * 10) / 10;
  return (
    <Typography variant={"body2"} sx={{ whiteSpace: "nowrap" }}>
      {rounded > 0 ? "▲ " : rounded < 0 ? "▼ " : ""}
      {formatRate(rounded)}
    </Typography>
  );
}

/** 名次變化：正數＝名次往前 */
export function TwStatsRankChange({ change }: { change: number }) {
  return (
    <Typography
      variant={"body2"}
      fontWeight={700}
      color={change > 0 ? "primary.main" : "text.secondary"}
      sx={{ whiteSpace: "nowrap" }}
    >
      {change > 0 ? `↑ ${change}` : `↓ ${-change}`}
    </Typography>
  );
}
