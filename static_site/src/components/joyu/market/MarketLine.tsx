import { Box, Typography } from "@mui/material";

/** 股市卡片裡的一行「標籤……數字」（資產、報價、持股共用）；bold 是合計那一行 */
export function MarketLine({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        fontSize: bold ? 15 : 14,
        fontWeight: bold ? 700 : 400,
        justifyContent: "space-between",
        py: 0.4,
      }}
    >
      <Typography
        color={bold ? "text.primary" : "text.secondary"}
        sx={{ fontSize: "inherit", fontWeight: "inherit" }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          color,
          fontSize: "inherit",
          fontVariantNumeric: "tabular-nums",
          fontWeight: "inherit",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
