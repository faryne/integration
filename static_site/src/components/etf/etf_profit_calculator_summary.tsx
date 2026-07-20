import { Box, Grid, Typography } from "@mui/material";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";
import {
  formatCurrencyAmount,
  formatRate,
} from "@/components/etf/etf_profit_calculator_format.ts";

interface ProfitSummaryProps {
  result: ProfitResult;
  currencySymbol: string;
  amountDecimals: number;
  withholdingRate: number;
  getTrendColor: (value: number) => string;
}

// 試算結果總結：已實現盈虧 / 未實現盈虧 / 總盈虧 / 最終持有股數
export function ProfitSummary({
  result,
  currencySymbol,
  amountDecimals,
  withholdingRate,
  getTrendColor,
}: ProfitSummaryProps) {
  const formatAmount = (amount: number) =>
    formatCurrencyAmount(currencySymbol, amount, amountDecimals);
  const realizedCaption =
    `配息 ${formatAmount(result.realizedDividend)} + 已處分 ${formatAmount(result.realizedPriceGain)}` +
    (withholdingRate > 0
      ? ` + 預估退稅 ${formatAmount(result.realizedRefund)}`
      : "");
  const unrealizedCaption = `配息(未除息) ${formatAmount(result.unrealizedDividend)} + 未處分 ${formatAmount(result.unrealizedPriceGain)}`;

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
            {formatAmount(result.realizedTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: getTrendColor(result.realizedTotal) }}
          >
            {formatRate(result.realizedRate, "尚無成本可計算")}
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
            {formatAmount(result.unrealizedTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: getTrendColor(result.unrealizedTotal) }}
          >
            {formatRate(result.unrealizedRate, "尚無成本可計算")}
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
            {formatAmount(result.grandTotal)}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.grandTotal) }}
          >
            {formatRate(result.grandTotalRate, "尚無成本可計算")}
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
          <Typography
            variant="caption"
            component="p"
            color="text.secondary"
            sx={{ lineHeight: 1.4 }}
          >
            總成本 {formatAmount(result.totalCost)}
          </Typography>
        </Grid>
      </Grid>

      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        align="center"
        sx={{ mt: 2, lineHeight: 1.5 }}
      >
        * 以上結果不含券商手續費、證券交易稅（賣出時課徵）等交易成本
        {withholdingRate === 0 &&
          "，也未扣除單筆配息達起扣金額（目前為 2 萬元）需負擔的二代健保補充保費（費率 2.11%）"}
        ，實際損益會比試算結果更低。
      </Typography>
    </Box>
  );
}
