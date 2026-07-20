import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import dayjs from "dayjs";
import ApexCharts from "apexcharts/candlestick";
import { useGetTwseEtfTicker } from "@/apis/opendata/twse_etf.ts";
import { DetailStat } from "@/components/etf/etf_detail_stat.tsx";
import {
  formatDecimal,
  formatPercent,
  formatSignedPercent,
} from "@/pages/etfs/twse_format_helpers.ts";

type TickerViewMode = "chart" | "table";

const formatInteger = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Math.round(value).toLocaleString("zh-TW");
};

const averageClose = <T extends { close: number }>(rows: T[]) => {
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + row.close, 0) / rows.length;
};

const rangePositionByClose = <T extends { close: number }>(rows: T[]) => {
  if (rows.length === 0) return null;

  const latest = rows[rows.length - 1];
  const closes = rows.map((row) => row.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const range = high - low;

  if (range <= 0) {
    return 0;
  }
  return ((latest.close - low) / range) * 100;
};

export const EtfCandleChart = ({
  etfCode,
  etfName,
}: {
  etfCode: string;
  etfName: string;
}) => {
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const [startDate, setStartDate] = useState(
    dayjs().subtract(3, "month").format("YYYY-MM-DD"),
  );
  const [endDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedEndDate, setSelectedEndDate] = useState(endDate);
  const [viewMode, setViewMode] = useState<TickerViewMode>("chart");

  const maxEndDate = useMemo(() => {
    const oneYearLater = dayjs(startDate).add(1, "year");
    const todayValue = dayjs(today);
    return (
      oneYearLater.isBefore(todayValue) ? oneYearLater : todayValue
    ).format("YYYY-MM-DD");
  }, [startDate, today]);

  const dateRangeError = useMemo(() => {
    const start = dayjs(startDate);
    const end = dayjs(selectedEndDate);

    if (!start.isValid() || !end.isValid()) {
      return "請選擇有效的日期區間。";
    }

    if (end.isBefore(start, "day")) {
      return "結束日期不能早於開始日期。";
    }

    if (end.isAfter(start.add(1, "year"), "day")) {
      return "起訖期間最多一年。";
    }

    if (end.isAfter(dayjs(today), "day")) {
      return "結束日期不能晚於今日。";
    }

    return "";
  }, [selectedEndDate, startDate, today]);

  const canQueryTicker = !dateRangeError;

  const query = useGetTwseEtfTicker(
    etfCode,
    startDate,
    selectedEndDate,
    canQueryTicker,
  );
  const tickerRows = useMemo(
    () =>
      [...(query.data?.data ?? [])].sort(
        (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
      ),
    [query.data?.data],
  );
  const calculatedTickerRows = useMemo(
    () =>
      tickerRows.map((row, index) => {
        const rowsToDate = tickerRows.slice(0, index + 1);
        const rows5 = rowsToDate.slice(-5);
        const rows20 = rowsToDate.slice(-20);
        const rows60 = rowsToDate.slice(-60);
        const rows120 = rowsToDate.slice(-120);
        const ma5 = rowsToDate.length >= 5 ? averageClose(rows5) : null;
        const ma20 = rowsToDate.length >= 20 ? averageClose(rows20) : null;

        return {
          ...row,
          calculated_ma5: ma5,
          calculated_ma20: ma20,
          calculated_ma60:
            rowsToDate.length >= 60 ? averageClose(rows60) : null,
          calculated_ma120:
            rowsToDate.length >= 120 ? averageClose(rows120) : null,
          calculated_ma20_bias_rate:
            ma20 !== null && ma20 > 0
              ? ((row.close - ma20) / ma20) * 100
              : null,
          calculated_range_position_20:
            rowsToDate.length >= 20 ? rangePositionByClose(rows20) : null,
          calculated_range_position_60:
            rowsToDate.length >= 60 ? rangePositionByClose(rows60) : null,
          calculated_range_position_120:
            rowsToDate.length >= 120 ? rangePositionByClose(rows120) : null,
        };
      }),
    [tickerRows],
  );
  const indicatorVisibility = useMemo(
    () => ({
      ma5: calculatedTickerRows.length >= 5,
      ma20: calculatedTickerRows.length >= 20,
      ma60: calculatedTickerRows.length >= 60,
      ma120: calculatedTickerRows.length >= 120,
      range20: calculatedTickerRows.length >= 20,
      range60: calculatedTickerRows.length >= 60,
      range120: calculatedTickerRows.length >= 120,
    }),
    [calculatedTickerRows.length],
  );
  const tickerTableRows = useMemo(
    () =>
      [...calculatedTickerRows].sort(
        (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf(),
      ),
    [calculatedTickerRows],
  );
  const closeRange = useMemo(() => {
    return calculatedTickerRows.reduce<{
      high: (typeof calculatedTickerRows)[number] | null;
      low: (typeof calculatedTickerRows)[number] | null;
    }>(
      (result, row) => {
        if (!result.high || row.close > result.high.close) {
          result.high = row;
        }

        if (!result.low || row.close < result.low.close) {
          result.low = row;
        }

        return result;
      },
      { high: null, low: null },
    );
  }, [calculatedTickerRows]);
  const tickerStats = useMemo(() => {
    const first = calculatedTickerRows[0] ?? null;
    const latest =
      calculatedTickerRows[calculatedTickerRows.length - 1] ?? null;
    const high = closeRange.high;
    const low = closeRange.low;
    const range = high && low ? high.close - low.close : 0;
    const returnRate =
      first && latest && first.close > 0
        ? ((latest.close - first.close) / first.close) * 100
        : null;
    const position =
      latest && low && range > 0
        ? ((latest.close - low.close) / range) * 100
        : null;
    const amplitude =
      high && low && low.close > 0 ? (range / low.close) * 100 : null;

    return {
      amplitude,
      high,
      latest,
      low,
      position,
      returnRate,
    };
  }, [calculatedTickerRows, closeRange.high, closeRange.low]);
  const tickerTableColumnCount =
    8 +
    Number(indicatorVisibility.range20) +
    Number(indicatorVisibility.range60) +
    Number(indicatorVisibility.range120) +
    Number(indicatorVisibility.ma5) +
    Number(indicatorVisibility.ma20) +
    Number(indicatorVisibility.ma60) +
    Number(indicatorVisibility.ma120) +
    Number(indicatorVisibility.ma20);

  // 將資料轉換為 ApexCharts 格式
  const series = useMemo(
    () => [
      {
        data: tickerRows.map((item) => ({
          x: dayjs(item.date).format("YYYY-MM-DD"),
          y: [item.open, item.max, item.min, item.close],
        })),
      },
    ],
    [tickerRows],
  );

  const options: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: {
        type: "candlestick",
        height: 350,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        animations: { enabled: true },
        fontFamily: theme.typography.fontFamily,
        background: "transparent",
      },
      title: {
        text: `${etfName} (${etfCode}) 股價走勢 ${startDate} ~ ${selectedEndDate}`,
        align: "left",
        style: {
          fontSize: "18px",
          fontWeight: 600,
          color: theme.palette.text.primary,
        },
      },
      xaxis: {
        type: "datetime",
        labels: {
          datetimeFormatter: {
            year: "yyyy",
            month: "MMM 'yy",
            day: "dd MMM",
            hour: "HH:mm",
          },
          style: { colors: theme.palette.text.secondary },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          formatter: (val) => val.toFixed(2),
          style: { colors: theme.palette.text.secondary },
        },
        forceNiceScale: true,
      },
      tooltip: {
        enabled: true,
        theme: theme.palette.mode,
        shared: true,
        intersect: false,
        x: {
          format: "yyyy-MM-dd",
        },
        fixed: {
          enabled: false,
          position: "topRight",
        },
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          // apexcharts 的 series 型別是 candlestick 的物件陣列（含 data）跟
          // pie/donut 用的純數字陣列（number[]）的聯集，但這張圖固定是 candlestick，
          // 一定是前者，所以在這裡窄化型別，不影響其他圖表共用的型別定義。
          const seriesEntry = w.config.series?.[seriesIndex] as
            { data?: { x: string | number; y: number[] }[] } | undefined;
          const point = seriesEntry?.data?.[dataPointIndex];
          const values = point?.y ?? [];
          const [open, high, low, close] = values;
          const date = point?.x ? dayjs(point.x).format("YYYY-MM-DD") : "--";
          const rows = [
            ["開盤", open],
            ["最高", high],
            ["最低", low],
            ["收盤", close],
          ];

          return `
            <div style="min-width: 152px; padding: 10px 12px; color: ${theme.palette.text.primary};">
              <div style="font-size: 12px; font-weight: 800; color: ${theme.palette.text.secondary}; margin-bottom: 8px;">
                ${date}
              </div>
              ${rows
                .map(
                  ([label, value]) => `
                    <div style="display: flex; justify-content: space-between; gap: 18px; font-size: 12px; line-height: 1.7;">
                      <span style="color: ${theme.palette.text.secondary};">${label}</span>
                      <strong>${Number(value).toFixed(2)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
        },
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#ef5350", // 台灣習慣：漲紅
            downward: "#26a69a", // 台灣習慣：跌綠
          },
          wick: {
            useFillColor: true,
          },
        },
      },
      grid: {
        borderColor: theme.palette.divider,
        strokeDashArray: 4,
      },
    }),
    [
      etfCode,
      etfName,
      selectedEndDate,
      startDate,
      theme.palette.divider,
      theme.palette.mode,
      theme.palette.text.primary,
      theme.palette.text.secondary,
      theme.typography.fontFamily,
    ],
  );

  useEffect(() => {
    if (
      !chartRef.current ||
      viewMode !== "chart" ||
      dateRangeError ||
      query.isLoading ||
      query.isError
    ) {
      return;
    }

    const chart = new ApexCharts(chartRef.current, {
      ...options,
      series,
    });

    chart.render();

    return () => {
      chart.destroy();
    };
  }, [
    dateRangeError,
    options,
    query.isError,
    query.isLoading,
    series,
    viewMode,
  ]);

  return (
    <Box
      sx={{
        width: "100%",
        mt: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        sx={{ mb: 2 }}
      >
        <TextField
          label="開始日期"
          type="date"
          size="small"
          value={startDate}
          onChange={(event) => {
            const nextStartDate = event.target.value;
            setStartDate(nextStartDate);
            const nextMaxEndDate = dayjs(nextStartDate)
              .add(1, "year")
              .format("YYYY-MM-DD");

            if (dayjs(selectedEndDate).isAfter(nextMaxEndDate, "day")) {
              setSelectedEndDate(
                dayjs(nextMaxEndDate).isAfter(today, "day")
                  ? today
                  : nextMaxEndDate,
              );
            }
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: selectedEndDate,
            },
          }}
          sx={{ minWidth: { sm: 180 } }}
        />
        <TextField
          label="結束日期"
          type="date"
          size="small"
          value={selectedEndDate}
          onChange={(event) => {
            setSelectedEndDate(event.target.value);
          }}
          error={!!dateRangeError}
          helperText={dateRangeError || "最多查詢一年區間"}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              min: startDate,
              max: maxEndDate,
            },
          }}
          sx={{ minWidth: { sm: 180 } }}
        />
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewMode}
          onChange={(_, nextMode: TickerViewMode | null) => {
            if (nextMode) {
              setViewMode(nextMode);
            }
          }}
          aria-label="歷史股價顯示模式"
          sx={{
            "& .MuiToggleButton-root": {
              px: 1.5,
              fontWeight: 800,
              borderRadius: 1.5,
            },
          }}
        >
          <ToggleButton value="chart">K 線圖</ToggleButton>
          <ToggleButton value="table">表格</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <DetailStat
          label="最新收盤"
          value={
            tickerStats.latest ? (
              <Box>
                {tickerStats.latest.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.latest.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="primary.main"
        />
        <DetailStat
          label="區間最高收盤"
          value={
            tickerStats.high ? (
              <Box>
                {tickerStats.high.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.high.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="error.main"
        />
        <DetailStat
          label="區間最低收盤"
          value={
            tickerStats.low ? (
              <Box>
                {tickerStats.low.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.low.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="success.main"
        />
        <DetailStat
          label="區間報酬"
          value={formatSignedPercent(tickerStats.returnRate)}
          tone={
            tickerStats.returnRate && tickerStats.returnRate >= 0
              ? "error.main"
              : "success.main"
          }
        />
        <DetailStat
          label="區間位置"
          value={
            tickerStats.position === null
              ? "--"
              : `${tickerStats.position.toFixed(2)}%`
          }
        />
        <DetailStat
          label="區間振幅"
          value={
            tickerStats.amplitude === null
              ? "--"
              : `${tickerStats.amplitude.toFixed(2)}%`
          }
        />
        {indicatorVisibility.ma5 && (
          <DetailStat
            label="MA5"
            value={formatDecimal(tickerStats.latest?.calculated_ma5)}
          />
        )}
        {indicatorVisibility.ma20 && (
          <DetailStat
            label="MA20"
            value={formatDecimal(tickerStats.latest?.calculated_ma20)}
          />
        )}
        {indicatorVisibility.ma20 && (
          <DetailStat
            label="MA20 乖離"
            value={formatSignedPercent(
              tickerStats.latest?.calculated_ma20_bias_rate,
            )}
            tone={
              (tickerStats.latest?.calculated_ma20_bias_rate ?? 0) >= 0
                ? "error.main"
                : "success.main"
            }
          />
        )}
        {indicatorVisibility.ma60 && (
          <DetailStat
            label="MA60"
            value={formatDecimal(tickerStats.latest?.calculated_ma60)}
          />
        )}
        {indicatorVisibility.ma120 && (
          <DetailStat
            label="MA120"
            value={formatDecimal(tickerStats.latest?.calculated_ma120)}
          />
        )}
        {indicatorVisibility.range20 && (
          <DetailStat
            label="月區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_20,
            )}
          />
        )}
        {indicatorVisibility.range60 && (
          <DetailStat
            label="季區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_60,
            )}
          />
        )}
        {indicatorVisibility.range120 && (
          <DetailStat
            label="半年區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_120,
            )}
          />
        )}
      </Stack>

      {dateRangeError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {dateRangeError}
        </Alert>
      ) : query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : query.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          股價資料載入失敗，請稍後再試。
        </Alert>
      ) : null}
      {viewMode === "chart" ? (
        <Box ref={chartRef} sx={{ minHeight: 350 }} />
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2, overflowX: "auto" }}
        >
          <Table size="small" sx={{ minWidth: tickerTableColumnCount * 96 }}>
            <TableHead>
              <TableRow>
                {[
                  "日期",
                  "開盤",
                  "最高",
                  "最低",
                  "收盤",
                  ...(indicatorVisibility.range20 ? ["月區間位置"] : []),
                  ...(indicatorVisibility.range60 ? ["季區間位置"] : []),
                  ...(indicatorVisibility.range120 ? ["半年區間位置"] : []),
                  ...(indicatorVisibility.ma5 ? ["MA5"] : []),
                  ...(indicatorVisibility.ma20 ? ["MA20"] : []),
                  ...(indicatorVisibility.ma20 ? ["MA20 乖離"] : []),
                  ...(indicatorVisibility.ma60 ? ["MA60"] : []),
                  ...(indicatorVisibility.ma120 ? ["MA120"] : []),
                  "成交量",
                  "成交金額",
                  "交易筆數",
                ].map((label) => (
                  <TableCell
                    key={label}
                    align={label === "日期" ? "left" : "right"}
                    sx={{
                      bgcolor: "#f6f9fc",
                      color: "text.secondary",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tickerTableRows.length > 0 ? (
                tickerTableRows.map((row) => {
                  const isHighClose =
                    closeRange.high?.date === row.date &&
                    closeRange.high?.close === row.close;
                  const isLowClose =
                    closeRange.low?.date === row.date &&
                    closeRange.low?.close === row.close;

                  return (
                    <TableRow
                      key={row.date}
                      hover
                      sx={{
                        bgcolor: isHighClose
                          ? "rgba(239, 83, 80, 0.08)"
                          : isLowClose
                            ? "rgba(38, 166, 154, 0.08)"
                            : undefined,
                      }}
                    >
                      <TableCell>
                        {dayjs(row.date).format("YYYY-MM-DD")}
                      </TableCell>
                      <TableCell align="right">{row.open.toFixed(2)}</TableCell>
                      <TableCell align="right">{row.max.toFixed(2)}</TableCell>
                      <TableCell align="right">{row.min.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <span>{row.close.toFixed(2)}</span>
                          {isHighClose && (
                            <Chip
                              size="small"
                              label="區間最高"
                              color="error"
                              variant="outlined"
                              sx={{ height: 22, borderRadius: 1 }}
                            />
                          )}
                          {isLowClose && (
                            <Chip
                              size="small"
                              label="區間最低"
                              color="success"
                              variant="outlined"
                              sx={{ height: 22, borderRadius: 1 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      {indicatorVisibility.range20 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_20)}
                        </TableCell>
                      )}
                      {indicatorVisibility.range60 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_60)}
                        </TableCell>
                      )}
                      {indicatorVisibility.range120 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_120)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma5 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma5)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma20 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma20)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma20 && (
                        <TableCell align="right">
                          {formatSignedPercent(row.calculated_ma20_bias_rate)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma60 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma60)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma120 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma120)}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {formatInteger(row.volume)}
                      </TableCell>
                      <TableCell align="right">
                        {formatInteger(row.trading_money)}
                      </TableCell>
                      <TableCell align="right">
                        {formatInteger(row.trading_turnover)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tickerTableColumnCount}
                    align="center"
                    sx={{ py: 3 }}
                  >
                    查無股價資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
