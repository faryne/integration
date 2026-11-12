import { useState } from "react";
import {
  Box,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import dayjs from "dayjs";

import {
  useMarketHistory,
  type MarketPricePoint,
  type MarketStock,
} from "@/apis/av/joyu_market.ts";

const RANGES = [
  { days: 30, label: "30 天" },
  { days: 90, label: "90 天" },
  { days: 365, label: "1 年" },
];

/**
 * 今天這一根 K 棒：收盤 job 還沒跑，今天有成交或基本面變動時已經有一筆（收盤價換成現價），
 * 沒有的話用昨收當開盤、現價當收盤自己補
 */
function withToday(rows: MarketPricePoint[], stock: MarketStock) {
  const today = dayjs().format("YYYY-MM-DD");
  const last = rows.at(-1);
  const base =
    last?.date === today
      ? last
      : {
          date: today,
          open: stock.prev_close,
          high: stock.prev_close,
          low: stock.prev_close,
          volume: stock.volume,
        };
  return [
    ...rows.filter((r) => r.date !== today),
    {
      ...base,
      close: stock.price,
      high: Math.max(base.high, stock.price),
      low: Math.min(base.low, stock.price),
    },
  ];
}

/**
 * 個股 K 線圖＋成交量（apexcharts；MUI X Charts 免費版沒有 K 線）。顏色照台股習慣紅漲綠跌，跟著 joyu 淺色／深色模式。
 * 玩家少的時候每天只有基本面在動（最多 ±2.5%），K 棒會很短
 */
export function StockChart({ stock }: { stock: MarketStock }) {
  const theme = useTheme();
  const [days, setDays] = useState(90);
  const history = useMarketHistory(stock.code, days);
  const points = withToday(history.data ?? [], stock);
  const up = theme.palette.error.main;
  const down = theme.palette.success.main;
  const labelColor = theme.palette.text.secondary;
  const base: ApexOptions = {
    chart: {
      background: "transparent",
      fontFamily: "inherit",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    grid: { borderColor: theme.palette.divider },
    theme: { mode: theme.palette.mode },
    tooltip: { theme: theme.palette.mode },
    xaxis: {
      labels: { rotate: 0, style: { colors: labelColor } },
      tickAmount: 6,
      type: "category",
    },
  };
  const candle: ApexOptions = {
    ...base,
    plotOptions: {
      candlestick: {
        colors: { downward: down, upward: up },
        wick: { useFillColor: true },
      },
    },
    xaxis: { ...base.xaxis, labels: { show: false } },
    yaxis: {
      labels: { formatter: (v) => v.toFixed(2), style: { colors: labelColor } },
    },
  };
  const volume: ApexOptions = {
    ...base,
    colors: [theme.palette.text.disabled],
    dataLabels: { enabled: false },
    yaxis: {
      labels: {
        formatter: (v) => Math.round(v).toLocaleString(),
        style: { colors: labelColor },
      },
      // 成交量圖很矮，只標 0 跟最大值，標多了會疊在一起
      tickAmount: 1,
    },
  };

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 17, fontWeight: 800, mr: "auto" }}
        >
          K 線
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
        <Skeleton height={300} variant="rounded" />
      ) : (
        <Box sx={{ mx: -1 }}>
          <Chart
            height={220}
            options={candle}
            series={[
              {
                data: points.map((p) => ({
                  x: p.date.slice(5),
                  y: [p.open, p.high, p.low, p.close],
                })),
                name: "股價",
              },
            ]}
            type="candlestick"
          />
          <Chart
            height={90}
            options={volume}
            series={[
              {
                data: points.map((p) => ({ x: p.date.slice(5), y: p.volume })),
                name: "成交量",
              },
            ]}
            type="bar"
          />
        </Box>
      )}
    </Paper>
  );
}
