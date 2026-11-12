import { Box, Paper, Stack, Typography } from "@mui/material";

import { stockChangePct, type MarketStock } from "@/apis/av/joyu_market.ts";
import { marketIndex, money } from "@/helpers/joyuMarket.ts";

import { StockChange } from "./StockChange.tsx";

const num = { fontVariantNumeric: "tabular-nums" } as const;

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, ...num }}>
        {children}
      </Typography>
    </Box>
  );
}

/**
 * 股市總覽頂端：joyu 指數（每檔現價相對 IPO 的平均，前端用列表算，不另外打 API）、上市檔數、上漲／下跌家數、今日成交量
 */
export function MarketIndexCard({ stocks }: { stocks: MarketStock[] }) {
  const index = marketIndex(stocks.map((s) => s.price));
  const prev = marketIndex(stocks.map((s) => s.prev_close));
  const changes = stocks.map(stockChangePct);
  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={{ xs: 2, md: 4 }}
        sx={{ alignItems: "center" }}
      >
        <Box>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            joyu 指數
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography
              sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, ...num }}
            >
              {money(index)}
            </Typography>
            <StockChange
              pct={prev ? ((index - prev) / prev) * 100 : 0}
              sx={{ fontSize: 15 }}
            />
          </Stack>
        </Box>
        <Item label="上市">{stocks.length} 檔</Item>
        <Item label="上漲／下跌">
          <Box component="span" sx={{ color: "error.main" }}>
            {changes.filter((c) => c > 0.004).length}
          </Box>
          ／
          <Box component="span" sx={{ color: "success.main" }}>
            {changes.filter((c) => c < -0.004).length}
          </Box>
        </Item>
        <Item label="今日成交量">
          {stocks.reduce((a, s) => a + s.volume, 0).toLocaleString()} 股
        </Item>
      </Stack>
    </Paper>
  );
}
