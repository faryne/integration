import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { ProfitDetailRow } from "@/components/etf/etf_profit_calculator_types.ts";
import { formatCurrencyAmount } from "@/components/etf/etf_profit_calculator_format.ts";

interface ProfitDetailTableProps {
  rows: ProfitDetailRow[];
  currencySymbol: string;
  amountDecimals: number;
  showNetAmount: boolean;
  getTrendColor: (value: number) => string;
}

const TYPE_LABEL: Record<ProfitDetailRow["type"], string> = {
  dividend: "配息",
  sell: "賣出",
};

// 配息（含尚未除息、已公告金額的）跟賣出損益混在一起、依日期排序的明細，
// 用「狀態」欄位的 Chip 區分已實現／未實現。
export function ProfitDetailTable({
  rows,
  currencySymbol,
  amountDecimals,
  showNetAmount,
  getTrendColor,
}: ProfitDetailTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        配息 & 已處分獲利明細
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>日期</TableCell>
              <TableCell>類型</TableCell>
              <TableCell>說明</TableCell>
              <TableCell align="right">金額</TableCell>
              {showNetAmount && <TableCell align="right">稅後實領</TableCell>}
              <TableCell align="center">狀態</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{TYPE_LABEL[row.type]}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell
                  align="right"
                  sx={
                    row.type === "sell"
                      ? { color: getTrendColor(row.grossAmount) }
                      : undefined
                  }
                >
                  {formatCurrencyAmount(
                    currencySymbol,
                    row.grossAmount,
                    amountDecimals,
                  )}
                </TableCell>
                {showNetAmount && (
                  <TableCell align="right">
                    {row.netAmount === null
                      ? "—"
                      : formatCurrencyAmount(
                          currencySymbol,
                          row.netAmount,
                          amountDecimals,
                        )}
                  </TableCell>
                )}
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={row.realized ? "已實現" : "未實現"}
                    color={row.realized ? "success" : "warning"}
                    variant={row.realized ? "filled" : "outlined"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
