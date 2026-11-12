import { Box, Paper, Typography } from "@mui/material";
import dayjs from "dayjs";

import {
  useMarketWallet,
  type MarketStockDetail,
} from "@/apis/av/joyu_market.ts";
import { changeColor, money, signedPct } from "@/helpers/joyuMarket.ts";

import { MarketLine } from "./MarketLine.tsx";
import { useMarketUid } from "./useMarketUid.ts";

const titleSx = { fontSize: 17, fontWeight: 800, mb: 1 } as const;

/** 個股頁右欄：我在這檔的持股（沒持股就不顯示）。可賣股數不含今天買的（T+1） */
export function StockHoldingCard({ code }: { code: string }) {
  const { uid } = useMarketUid();
  const wallet = useMarketWallet(uid);
  const h = wallet.data?.holdings.find((x) => x.stock.code === code);
  if (!h) return null;
  const value = h.stock.price * h.shares;
  const gain = value - h.cost;
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography component="h2" sx={titleSx}>
        我的持股
      </Typography>
      <MarketLine
        label="股數"
        value={
          h.sellable < h.shares
            ? `${h.shares.toLocaleString()}（可賣 ${h.sellable.toLocaleString()}）`
            : h.shares.toLocaleString()
        }
      />
      <MarketLine label="平均成本" value={money(h.cost / h.shares)} />
      <MarketLine label="市值" value={money(value)} />
      <Box sx={{ borderTop: 1, borderColor: "divider", mt: 0.5, pt: 0.5 }}>
        <MarketLine
          bold
          color={changeColor(gain)}
          label="損益"
          value={`${gain > 0 ? "+" : ""}${money(gain)}（${signedPct((gain / h.cost) * 100)}）`}
        />
      </Box>
    </Paper>
  );
}

/** 個股頁右欄：最近成交（不顯示是誰），紅買綠賣 */
export function RecentTradesCard({ stock }: { stock: MarketStockDetail }) {
  if (stock.recent_trades.length === 0) return null;
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography component="h2" sx={titleSx}>
        最近成交
      </Typography>
      {stock.recent_trades.map((t, i) => (
        <Box
          key={i}
          sx={{
            display: "grid",
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            gridTemplateColumns: "auto 2em 1fr 1fr",
            gap: 1,
            py: 0.4,
          }}
        >
          <Typography color="text.secondary" sx={{ fontSize: "inherit" }}>
            {dayjs(t.created_at).format("MM/DD HH:mm")}
          </Typography>
          <Typography
            sx={{
              color: t.side === "buy" ? "error.main" : "success.main",
              fontSize: "inherit",
            }}
          >
            {t.side === "buy" ? "買" : "賣"}
          </Typography>
          <Typography sx={{ fontSize: "inherit", textAlign: "right" }}>
            {t.shares.toLocaleString()} 股
          </Typography>
          <Typography sx={{ fontSize: "inherit", textAlign: "right" }}>
            {money(t.price)}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}
