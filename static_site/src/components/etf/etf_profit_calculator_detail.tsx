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

// 可排序的欄位：日期 + 三個金額類欄位（金額本身、稅後實領、預估退稅）
type SortField = "date" | "grossAmount" | "netAmount" | "refundAmount";
type SortDirection = "asc" | "desc";

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
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showAll, setShowAll] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortField(null);
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;

    return [...rows].sort((a, b) => {
      if (sortField === "date") {
        return sortDirection === "asc"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }

      const av = a[sortField];
      const bv = b[sortField];
      // netAmount/refundAmount 可能是 null（賣出列、或美股沒有 ROC 資料的配息列），
      // 不管排序方向都排到最後面，避免跟真正的 0 元混在一起
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDirection === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortField, sortDirection]);

  const isLimited = maxVisibleRows > 0 && sortedRows.length > maxVisibleRows;
  const visibleRows =
    isLimited && !showAll ? sortedRows.slice(0, maxVisibleRows) : sortedRows;

  if (rows.length === 0) {
    return null;
  }

  const renderSortableHeader = (
    field: SortField,
    label: string,
    align: "left" | "right" = "left",
  ) => (
    <TableCell
      align={align}
      sortDirection={sortField === field ? sortDirection : false}
    >
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDirection : "asc"}
        onClick={() => toggleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        配息 & 已處分獲利明細
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {renderSortableHeader("date", "日期")}
              <TableCell>類型</TableCell>
              <TableCell>說明</TableCell>
              {renderSortableHeader("grossAmount", "金額", "right")}
              {showNetAmount &&
                renderSortableHeader("netAmount", "稅後實領", "right")}
              {showNetAmount &&
                renderSortableHeader("refundAmount", "預估退稅", "right")}
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
