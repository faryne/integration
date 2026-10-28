import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
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

// 類型欄用不同顏色的 outlined Chip 區分，避開狀態欄已用的 success／warning
const TYPE_CHIP: Record<
  ProfitDetailRow["type"],
  { label: string; color: "info" | "secondary" }
> = {
  dividend: { label: "配息", color: "info" },
  sell: { label: "賣出", color: "secondary" },
};

// 可排序的欄位：日期 + 三個金額類欄位（金額本身、稅後實領、預估退稅）
type SortField = "date" | "grossAmount" | "netAmount" | "refundAmount";
type SortDirection = "asc" | "desc";

// 明細分頁：全部／配息／已處分（賣出），all 以外直接對應 row.type
type DetailTab = "all" | ProfitDetailRow["type"];
const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "dividend", label: "配息" },
  { value: "sell", label: "已處分" },
];

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
  const [tab, setTab] = useState<DetailTab>("all");

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

  // 目前分頁的資料列；footer 合計也以此為範圍（不受「顯示更多」截斷影響）
  const tabRows = useMemo(
    () => (tab === "all" ? rows : rows.filter((row) => row.type === tab)),
    [rows, tab],
  );

  const sortedRows = useMemo(() => {
    if (!sortField) return tabRows;

    return [...tabRows].sort((a, b) => {
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
  }, [tabRows, sortField, sortDirection]);

  // 目前分頁「金額」欄合計（配息為總配息、賣出為已實現損益）
  const total = useMemo(
    () => tabRows.reduce((sum, row) => sum + row.grossAmount, 0),
    [tabRows],
  );

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
      <Tabs
        value={tab}
        onChange={(_, value: DetailTab) => setTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 1 }}
      >
        {DETAIL_TABS.map(({ value, label }) => {
          const count =
            value === "all"
              ? rows.length
              : rows.filter((row) => row.type === value).length;
          return (
            <Tab
              key={value}
              value={value}
              label={`${label} (${count})`}
              disabled={count === 0}
            />
          );
        })}
      </Tabs>
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
                <TableCell>
                  <Chip size="small" variant="outlined" {...TYPE_CHIP[row.type]} />
                </TableCell>
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
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} align="right">
                <Typography variant="body2" fontWeight="bold">
                  總金額
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ color: getTrendColor(total) }}>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrencyAmount(currencySymbol, total, amountDecimals)}
                </Typography>
              </TableCell>
              {/* 稅後實領／預估退稅／狀態欄位不加總，留白 */}
              <TableCell colSpan={showNetAmount ? 3 : 1} />
            </TableRow>
          </TableFooter>
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
