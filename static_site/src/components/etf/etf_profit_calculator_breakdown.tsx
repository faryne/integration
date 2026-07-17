import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { DistributionBreakdownRow } from "@/components/etf/etf_profit_calculator_types.ts";

interface ProfitBreakdownTableProps {
  rows: DistributionBreakdownRow[];
  currencySymbol: string;
  showNetAmount: boolean;
}

// 逐筆列出試算範圍內每個除息日「持有股數 x 每股配息 = 總配息」的明細
export function ProfitBreakdownTable({
  rows,
  currencySymbol,
  showNetAmount,
}: ProfitBreakdownTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        配息明細
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>除息日</TableCell>
              <TableCell align="right">持有股數</TableCell>
              <TableCell align="right">每股配息</TableCell>
              <TableCell align="right">總配息</TableCell>
              {showNetAmount && <TableCell align="right">稅後實領</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.exDate}>
                <TableCell>{row.exDate}</TableCell>
                <TableCell align="right">
                  {row.shares.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </TableCell>
                <TableCell align="right">{row.perShare.toFixed(4)}</TableCell>
                <TableCell align="right">
                  {currencySymbol}
                  {row.grossAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                {showNetAmount && (
                  <TableCell align="right">
                    {currencySymbol}
                    {row.netAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
