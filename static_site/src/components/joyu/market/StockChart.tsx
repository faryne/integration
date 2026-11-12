import { useState } from "react";
import {
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import dayjs from "dayjs";

import { useMarketHistory, type MarketStock } from "@/apis/av/joyu_market.ts";

const RANGES = [
  { days: 30, label: "30 天" },
  { days: 90, label: "90 天" },
  { days: 365, label: "1 年" },
];

/**
 * 個股走勢：每日收盤（收盤 job 每天 00:00 寫一筆），今天還沒收盤就把現價接在最後一點。
 * 剛上市只有一兩點時也照畫（就是一小段線）
 */
export function StockChart({ stock }: { stock: MarketStock }) {
  const theme = useTheme();
  const [days, setDays] = useState(90);
  const history = useMarketHistory(stock.code, days);
  const today = dayjs().format("YYYY-MM-DD");
  const points = [
    ...(history.data ?? []).filter((p) => p.date !== today),
    { close: stock.price, date: today },
  ];
  // 剛上市還沒有收盤紀錄時只有今天一點、畫不出線：前面補一點昨收
  if (points.length === 1)
    points.unshift({ close: stock.prev_close, date: "昨收" });

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 17, fontWeight: 800, mr: "auto" }}
        >
          走勢
        </Typography>
        {RANGES.map((r) => (
          <Chip
            color={days === r.days ? "primary" : "default"}
            key={r.days}
            label={r.label}
            onClick={() => setDays(r.days)}
            size="small"
            variant={days === r.days ? "filled" : "outlined"}
          />
        ))}
      </Stack>
      {history.isPending ? (
        <Skeleton height={220} variant="rounded" />
      ) : (
        <LineChart
          height={220}
          margin={{ bottom: 24, left: 8, right: 16, top: 12 }}
          series={[
            {
              color: theme.palette.primary.main,
              curve: "linear",
              data: points.map((p) => p.close),
              showMark: points.length <= 31,
              valueFormatter: (v) => (v == null ? "" : v.toFixed(2)),
            },
          ]}
          xAxis={[
            {
              data: points.map((p) =>
                p.date.includes("-") ? p.date.slice(5) : p.date,
              ),
              scaleType: "point",
            },
          ]}
          yAxis={[{ valueFormatter: (v: number) => v.toFixed(2), width: 52 }]}
        />
      )}
    </Paper>
  );
}
