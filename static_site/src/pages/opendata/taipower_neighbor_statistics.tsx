import {
  Alert,
  Box,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { useTaipowerNeighborStatistics } from "@/apis/opendata/taipower.ts";
import { TaipowerDataDisclaimer } from "@/components/common/TaipowerDataDisclaimer.tsx";
import { TaipowerNeighborBreadcrumb } from "@/components/taipower/TaipowerNeighborBreadcrumb.tsx";
import { integerToFinancialChinese } from "@/helpers/chineseNumber.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { TaipowerStatisticGroup } from "@/types/taipower.ts";

const basePath = "/data/taipower/neighbor";

function formatCash(value: number) {
  return Math.round(value * 1000).toLocaleString("zh-TW");
}

export default function TaipowerNeighborStatisticsPage() {
  const location = useLocation();
  const groupBy: TaipowerStatisticGroup = location.pathname.endsWith("/unit")
    ? "unit"
    : "cityarea";
  const label = groupBy === "unit" ? "受捐助單位" : "行政區";
  const query = useTaipowerNeighborStatistics(groupBy);
  const rows = query.data?.data ?? [];
  const visibleRows = groupBy === "unit" ? rows.slice(0, 100) : rows;
  const years = Array.from(
    new Set(rows.flatMap((row) => row.years.map((item) => item.year))),
  ).sort((a, b) => b - a);

  useTitle(`台電敦親睦鄰捐助－${label}統計`);

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <TaipowerNeighborBreadcrumb current={`${label}統計`} />
        <Paper
          variant="outlined"
          sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}
        >
          <Typography variant="h3" component="h1" fontWeight={900}>
            {label}捐助總額排名
          </Typography>
          <Typography color="text.secondary" mt={1}>
            依全部年度累計金額排序，表格金額均已由千元換算為新台幣元。
          </Typography>
          {query.data?.generated_at && (
            <Typography variant="caption" color="text.secondary">
              統計資料產生時間：
              {new Date(query.data.generated_at).toLocaleString("zh-TW")}
            </Typography>
          )}
        </Paper>

        {query.isError && <Alert severity="error">統計資料載入失敗。</Alert>}
        {query.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table
              stickyHeader
              sx={{ minWidth: Math.max(900, years.length * 150) }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>排名</TableCell>
                  <TableCell>{label}</TableCell>
                  <TableCell align="right">累計總額（新台幣元）</TableCell>
                  {years.map((year) => (
                    <TableCell key={year} align="right">
                      {year} 年
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => {
                  const yearly = new Map(
                    row.years.map((item) => [item.year, item.total_cash]),
                  );
                  const totalAmount = Math.round(row.total_cash * 1000);
                  return (
                    <TableRow key={row.name} hover>
                      <TableCell>{row.rank}</TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`${basePath}/${groupBy}/${encodeURIComponent(row.query_name)}`}
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell align="right">
                        {totalAmount.toLocaleString("zh-TW")}
                        <Typography
                          component="div"
                          variant="caption"
                          color="text.secondary"
                        >
                          {integerToFinancialChinese(totalAmount)}元
                        </Typography>
                      </TableCell>
                      {years.map((year) => (
                        <TableCell key={year} align="right">
                          {yearly.has(year)
                            ? formatCash(yearly.get(year) ?? 0)
                            : "－"}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {groupBy === "unit" && rows.length > visibleRows.length && (
          <Alert severity="info">
            受捐助單位共 {rows.length.toLocaleString("zh-TW")}{" "}
            筆，為避免瀏覽器負擔過重，本頁僅顯示總額排名前 100 名。
          </Alert>
        )}
      </Stack>
      <TaipowerDataDisclaimer />
    </Box>
  );
}
