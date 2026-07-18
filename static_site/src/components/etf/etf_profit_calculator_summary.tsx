import { Box, Grid, Typography } from "@mui/material";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";

interface ProfitSummaryProps {
  result: ProfitResult;
  currencySymbol: string;
  withholdingRate: number;
  getTrendColor: (value: number) => string;
}

const formatRate = (rate: number | null) =>
  rate === null
    ? "尚無成本可計算"
    : `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;

const formatAmount = (currencySymbol: string, amount: number) =>
  `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

// 試算結果總結：已實現盈虧 / 未實現盈虧 / 總盈虧 / 最終持有股數
export function ProfitSummary({
  result,
  currencySymbol,
  withholdingRate,
  getTrendColor,
}: ProfitSummaryProps) {
  const realizedCaption =
    `配息 ${formatAmount(currencySymbol, result.realizedDividend)} + 已處分 ${formatAmount(currencySymbol, result.realizedPriceGain)}` +
    (withholdingRate > 0
      ? ` + 預估退稅 ${formatAmount(currencySymbol, result.realizedRefund)}`
      : "");
  const unrealizedCaption = `配息(未除息) ${formatAmount(currencySymbol, result.unrealizedDividend)} + 未處分 ${formatAmount(currencySymbol, result.unrealizedPriceGain)}`;

  return (
    <Box sx={{ py: 2 }}>
      <Grid container spacing={2} textAlign="center">
        <Grid size={3}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
          >
            已實現盈虧
          </Typography>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.realizedTotal) }}
          >
            {formatAmount(currencySymbol, result.realizedTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: getTrendColor(result.realizedTotal) }}
          >
            {formatRate(result.realizedRate)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={{ lineHeight: 1.4 }}
          >
            {realizedCaption}
          </Typography>
        </Grid>

        <Grid size={3}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
          >
            未實現盈虧
          </Typography>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.unrealizedTotal) }}
          >
            {formatAmount(currencySymbol, result.unrealizedTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: getTrendColor(result.unrealizedTotal) }}
          >
            {formatRate(result.unrealizedRate)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={{ lineHeight: 1.4 }}
          >
            {unrealizedCaption}
          </Typography>
        </Grid>

        <Grid size={3}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
          >
            總盈虧
          </Typography>
          <Typography
            variant="h5"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.grandTotal) }}
          >
            {formatAmount(currencySymbol, result.grandTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.grandTotal) }}
          >
            {formatRate(result.grandTotalRate)}
          </Typography>
        </Grid>

        <Grid size={3}>
          <Typography variant="caption" color="text.secondary">
            最終持有股數
          </Typography>
          <Typography variant="h6">
            {result.finalShares.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}
