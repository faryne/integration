import { Box, Divider, Grid, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";

interface ProfitSummaryProps {
  result: ProfitResult;
  currencySymbol: string;
  withholdingRate: number;
  finalAmount: number;
  finalRate: number | null;
  getTrendColor: (value: number) => string;
}

const formatRate = (rate: number | null) =>
  rate === null
    ? "尚無成本可計算"
    : `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;

// 試算結果總結：股價價差 / 累計領息 / 最終盈虧，含美股專屬的預扣退稅區塊
export function ProfitSummary({
  result,
  currencySymbol,
  withholdingRate,
  finalAmount,
  finalRate,
  getTrendColor,
}: ProfitSummaryProps) {
  return (
    <Box sx={{ py: 2 }}>
      <Grid container spacing={2} textAlign="center" sx={{ mb: 2 }}>
        <Grid size={3}>
          <Typography variant="caption" color="text.secondary">
            股價價差
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: getTrendColor(result.totalPriceGain) }}
          >
            {currencySymbol}
            {result.totalPriceGain.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: getTrendColor(result.totalPriceGain) }}
          >
            未含息盈虧率 {formatRate(result.priceOnlyRate)}
          </Typography>
        </Grid>
        <Grid size={3}>
          <Typography variant="caption" color="text.secondary">
            累計領息{withholdingRate > 0 ? "（稅後）" : ""}
          </Typography>
          <Typography variant="h6" color="primary.main">
            {currencySymbol}
            {result.totalDiv.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
        </Grid>
        <Grid size={3}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
          >
            {withholdingRate > 0 ? "含息總損益" : "最終盈虧"}
          </Typography>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ color: getTrendColor(finalAmount) }}
          >
            {currencySymbol}
            {finalAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
          <Typography
            variant="caption"
            fontWeight="bold"
            sx={{ color: getTrendColor(finalAmount) }}
          >
            含息盈虧率 {formatRate(finalRate)}
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

      {withholdingRate > 0 && (
        <>
          <Divider sx={{ my: 1, borderStyle: "dashed" }} />

          <Grid container spacing={2} textAlign="center">
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary">
                <Tooltip title="基於歷史 ROC 比例試算之次年退稅總額">
                  <Box
                    component="span"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "help",
                    }}
                  >
                    預計退稅 <InfoOutlinedIcon sx={{ fontSize: 12, ml: 0.5 }} />
                  </Box>
                </Tooltip>
              </Typography>
              <Typography
                variant="subtitle1"
                color="success.main"
                fontWeight="bold"
              >
                +{currencySymbol}
                {result.totalRefund.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Grid>
            <Grid size={6}>
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight="bold"
              >
                含退稅總額 (最終盈虧)
              </Typography>
              <Typography
                variant="h5"
                fontWeight="bold"
                sx={{ color: getTrendColor(result.totalWithRefund) }}
              >
                {currencySymbol}
                {result.totalWithRefund.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
