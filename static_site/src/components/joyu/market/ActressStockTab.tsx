import { Box, Stack } from "@mui/material";

import type { MarketStockDetail } from "@/apis/av/joyu_market.ts";

import { StockChart } from "./StockChart.tsx";
import { StockQuoteCard } from "./StockQuoteCard.tsx";
import { RecentTradesCard, StockHoldingCard } from "./StockSideCards.tsx";
import { TradePanel } from "./TradePanel.tsx";

/**
 * 女優頁的「股票」分頁（?view=stock，這位上市過才有）：原本獨立的個股頁併進來，作品與討論女優頁本來就有，不再重複。
 * 桌機：左欄報價＋K 線、右欄交易／我的持股／最近成交；手機：報價 → 交易相關 → K 線（不用捲過圖才找得到交易）
 */
export function ActressStockTab({ stock }: { stock: MarketStockDetail }) {
  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 2,
        gridTemplateAreas: {
          xs: '"quote" "side" "chart"',
          md: '"quote side" "chart side"',
        },
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "minmax(0, 1fr) 320px",
        },
        // 右欄比報價卡高時，多出來的高度給第二列，報價卡和 K 線之間才不會空一大段
        gridTemplateRows: { md: "auto 1fr" },
        textAlign: "left",
      }}
    >
      <Box sx={{ gridArea: "quote", minWidth: 0 }}>
        <StockQuoteCard stock={stock} />
      </Box>
      <Stack spacing={2} sx={{ gridArea: "side", minWidth: 0 }}>
        <TradePanel stock={stock} />
        <StockHoldingCard code={stock.code} />
        <RecentTradesCard stock={stock} />
      </Stack>
      <Box sx={{ gridArea: "chart", minWidth: 0 }}>
        <StockChart stock={stock} />
      </Box>
    </Box>
  );
}
