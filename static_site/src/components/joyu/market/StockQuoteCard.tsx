import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import { stockChangePct, type MarketStock } from "@/apis/av/joyu_market.ts";

import { StockChange } from "./StockChange.tsx";

// 單日漲跌幅限制（跟後端一樣 ±20%），顯示漲停／跌停價
const PRICE_LIMIT = 0.2;
const num = { fontVariantNumeric: "tabular-nums" } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, px: 1.25, py: 1 }}>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, ...num }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * 女優頁「股票」分頁的報價卡：代碼、現價與漲跌、昨收與漲跌停價，加上基本價、近 90 天出片、流通／上限、
 * 今日買／賣股數與單數、上市日。照片和名字女優頁頂端已經有了，這裡不重複
 */
export function StockQuoteCard({ stock: s }: { stock: MarketStock }) {
  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
        <Typography color="text.secondary" sx={num}>
          {s.code}
        </Typography>
        <Typography
          sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2, ...num }}
        >
          {s.price.toFixed(2)}
        </Typography>
        <StockChange pct={stockChangePct(s)} sx={{ fontSize: 16 }} />
        {s.status === "delisted" && <Chip label="已下市" size="small" />}
      </Stack>
      <Typography color="text.secondary" sx={{ fontSize: 12, ...num }}>
        昨收 {s.prev_close.toFixed(2)}・漲停{" "}
        {(s.prev_close * (1 + PRICE_LIMIT)).toFixed(2)}・跌停{" "}
        {(s.prev_close * (1 - PRICE_LIMIT)).toFixed(2)}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
          },
          mt: 1.5,
        }}
      >
        <Stat label="基本價" value={s.fundamental.toFixed(2)} />
        <Stat label="近 90 天出片" value={`${s.videos_90d} 部`} />
        <Stat
          label="流通／上限"
          value={`${s.shares_out.toLocaleString()} / ${s.share_cap.toLocaleString()}`}
        />
        <Stat
          label="今日買／賣股數"
          value={`${s.buy_volume.toLocaleString()} / ${s.sell_volume.toLocaleString()}`}
        />
        <Stat
          label="今日買／賣單數"
          value={`${s.buy_count.toLocaleString()} / ${s.sell_count.toLocaleString()}`}
        />
        <Stat label="上市日" value={s.listed_at.slice(0, 10)} />
      </Box>
    </Paper>
  );
}
