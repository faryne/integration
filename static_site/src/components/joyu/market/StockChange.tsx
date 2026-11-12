import { Typography, type TypographyProps } from "@mui/material";

import { changeColor } from "@/helpers/joyuMarket.ts";

/** 漲跌幅文字：▲ +1.23% ／ ▼ -1.23% ／ 0.00% */
export function StockChange({
  pct,
  ...props
}: { pct: number } & TypographyProps) {
  const arrow = pct > 0.004 ? "▲ +" : pct < -0.004 ? "▼ " : "";
  return (
    <Typography
      component="span"
      sx={{ color: changeColor(pct), fontVariantNumeric: "tabular-nums" }}
      {...props}
    >
      {arrow}
      {pct.toFixed(2)}%
    </Typography>
  );
}
