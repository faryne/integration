import { Box, type SxProps, type Theme } from "@mui/material";

import { limitState } from "@/helpers/joyuMarket.ts";

/**
 * 股價數字：照台股慣例，漲停紅底白字、跌停綠底白字（反白），其他維持原本的字色。
 * 股市列表、女優頁股票分頁的報價卡共用
 */
export function StockPrice({
  price,
  prevClose,
  sx,
}: {
  price: number;
  prevClose: number;
  sx?: SxProps<Theme>;
}) {
  const limit = limitState(price, prevClose);
  return (
    <Box
      component="span"
      sx={[
        { fontVariantNumeric: "tabular-nums", fontWeight: 700 },
        !!limit && {
          bgcolor: limit === "up" ? "error.main" : "success.main",
          borderRadius: 1,
          color: "#fff",
          px: 0.75,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {price.toFixed(2)}
    </Box>
  );
}
