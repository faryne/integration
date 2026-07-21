import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
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
  // 超過這個筆數時先只顯示前 N 筆，其餘要點「顯示更多」才會展開；0 = 不限制，全部顯示。
  // 無論台股、美股頁面共用同一份預設值。
  maxVisibleRows?: number;
}

const TYPE_LABEL: Record<ProfitDetailRow["type"], string> = {
  dividend: "配息",
  sell: "賣出",
};

type AmountSortDirection = "asc" | "desc" | null;

// 配息（含尚未除息、已公告金額的）跟賣出損益混在一起、依日期排序的明細，
// 用「狀態」欄位的 Chip 區分已實現／未實現。
export function ProfitDetailTable({
  rows,
  currencySymbol,
  amountDecimals,
  showNetAmount,
  getTrendColor,
  maxVisibleRows = 20,
}: ProfitDetailTableProps) {
  const [amountSort, setAmountSort] = useState<AmountSortDirection>(null);
  const [showAll, setShowAll] = useState(false);

  const sortedRows = useMemo(() => {
    if (!amountSort) return rows;
    return [...rows].sort((a, b) =>
      amountSort === "asc"
        ? a.grossAmount - b.grossAmount
        : b.grossAmount - a.grossAmount,
    );
  }, [rows, amountSort]);

  const isLimited = maxVisibleRows > 0 && sortedRows.length > maxVisibleRows;
  const visibleRows =
    isLimited && !showAll ? sortedRows.slice(0, maxVisibleRows) : sortedRows;

  const toggleAmountSort = () => {
    setAmountSort((prev) =>
      prev === null ? "desc" : prev === "desc" ? "asc" : null,
    );
  };

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
              <TableCell align="right" sortDirection={amountSort ?? false}>
                <TableSortLabel
                  active={amountSort !== null}
                  direction={amountSort ?? "desc"}
                  onClick={toggleAmountSort}
                >
                  金額
                </TableSortLabel>
              </TableCell>
              {showNetAmount && <TableCell align="right">稅後實領</TableCell>}
              {showNetAmount && <TableCell align="right">預估退稅</TableCell>}
              <TableCell align="center">狀態</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
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
                {showNetAmount && (
                  <TableCell align="right">
                    {row.refundAmount === null
                      ? "—"
                      : formatCurrencyAmount(
                          currencySymbol,
                          row.refundAmount,
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
      {isLimited && !showAll && (
        <Button
          fullWidth
          size="small"
          variant="text"
          sx={{ mt: 1 }}
          onClick={() => setShowAll(true)}
        >
          顯示更多（還有 {sortedRows.length - maxVisibleRows} 筆，共{" "}
          {sortedRows.length} 筆）
        </Button>
      )}
    </Box>
  );
}
