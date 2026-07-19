import { Box, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";

interface ProfitQuickSummaryProps {
  result: ProfitResult;
  currencySymbol: string;
  getTrendColor: (value: number) => string;
  onJumpToDetail: () => void;
}

const formatAmount = (currencySymbol: string, amount: number) =>
  `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

// 交易紀錄一多，左側輸入區塊會拉得很長；這塊常駐在右側（桌面版 sticky），
// 讓使用者不用一直往下捲就能看到目前的試算結果，點連結可跳到下方完整明細。
export function ProfitQuickSummary({
  result,
  currencySymbol,
  getTrendColor,
  onJumpToDetail,
}: ProfitQuickSummaryProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, position: { md: "sticky" }, top: { md: 16 } }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight="bold">
        試算結果
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            已實現盈虧
          </Typography>
          <Typography
            variant="body1"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.realizedTotal) }}
          >
            {formatAmount(currencySymbol, result.realizedTotal)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            未實現盈虧
          </Typography>
          <Typography
            variant="body1"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.unrealizedTotal) }}
          >
            {formatAmount(currencySymbol, result.unrealizedTotal)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            總盈虧
          </Typography>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ color: getTrendColor(result.grandTotal) }}
          >
            {formatAmount(currencySymbol, result.grandTotal)}
          </Typography>
        </Box>
      </Stack>
      <MuiLink
        component="button"
        type="button"
        variant="body2"
        onClick={onJumpToDetail}
        sx={{ mt: 2, display: "inline-block" }}
      >
        查看完整明細 ↓
      </MuiLink>
    </Paper>
  );
}
