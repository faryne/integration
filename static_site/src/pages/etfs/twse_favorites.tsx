import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTitle } from "@/helpers/title.tsx";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { useTwseEtfFavorites } from "@/apis/opendata/etf_favorites.ts";
import {
  useGetTwseEtfCodeList,
  useGetTwseEtfInfoBatch,
} from "@/apis/opendata/twse_etf.ts";
import { useTwseEtfFavoritesTransactions } from "@/apis/opendata/etf_transactions.ts";
import { calcTransactionsResult } from "@/components/etf/etf_profit_calculator_engine.ts";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";
import type { EtfDistribution } from "@/types/etf.ts";

// 台股慣例：正數紅、負數綠
const getTrendColor = (value: number) => {
  if (value === 0) return "text.primary";
  return value > 0 ? "#d32f2f" : "#2e7d32";
};

const formatAmount = (amount: number) =>
  `NT$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

interface FavoriteRow {
  code: string;
  name: string;
  latestClose: number;
  result: ProfitResult;
}

const emptyTotals = {
  finalShares: 0,
  totalCost: 0,
  realizedTotal: 0,
  unrealizedTotal: 0,
  grandTotal: 0,
};

// 我的最愛 ETF 總覽：彙整每支已收藏 ETF 的已儲存交易紀錄，重用獲利試算的
// 計算引擎算出目前持股數、已實現/未實現/總盈虧與投入成本，列表 + 總計列呈現。
export default function TwseEtfFavoritesPage() {
  useTitle("我的最愛 ETF - Faryne 的實驗室");
  const navigate = useNavigate();
  const { session } = useAuth();

  const codeListQuery = useGetTwseEtfCodeList();
  const etfByCode = useMemo(
    () => new Map((codeListQuery.data?.data ?? []).map((e) => [e.code, e])),
    [codeListQuery.data],
  );

  const favoritesQuery = useTwseEtfFavorites();
  const favoriteCodes = useMemo(
    () => (favoritesQuery.data ?? []).map((f) => f.code),
    [favoritesQuery.data],
  );

  const infoQueries = useGetTwseEtfInfoBatch(favoriteCodes);
  const transactionsQueries = useTwseEtfFavoritesTransactions(favoriteCodes);

  const isLoading =
    favoritesQuery.isLoading ||
    codeListQuery.isLoading ||
    infoQueries.some((q) => q.isLoading) ||
    transactionsQueries.some((q) => q.isLoading);

  const rows = useMemo<FavoriteRow[]>(
    () =>
      favoriteCodes.map((code, index) => {
        const etf = etfByCode.get(code);
        const distributions: EtfDistribution[] = (
          infoQueries[index]?.data?.data?.stats ?? []
        ).map((s) => ({
          per_share: s.share,
          declared_date: s.ex_date,
          ex_date: s.ex_date,
          payable_date: s.payable_date,
          roc: -1, // 台股境內配息無 ROC 預扣退稅資料
        }));
        const records = transactionsQueries[index]?.data ?? [];
        const latestClose = etf?.latest_close ?? 0;
        return {
          code,
          name: etf?.name ?? code,
          latestClose,
          result: calcTransactionsResult(
            records,
            distributions,
            [],
            latestClose,
            0,
          ),
        };
      }),
    [favoriteCodes, etfByCode, infoQueries, transactionsQueries],
  );

  const totals = useMemo(
    () =>
      rows.reduce((acc, row) => {
        return {
          finalShares: acc.finalShares + row.result.finalShares,
          totalCost: acc.totalCost + row.result.totalCost,
          realizedTotal: acc.realizedTotal + row.result.realizedTotal,
          unrealizedTotal: acc.unrealizedTotal + row.result.unrealizedTotal,
          grandTotal: acc.grandTotal + row.result.grandTotal,
        };
      }, emptyTotals),
    [rows],
  );

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", color: "text.primary" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/data/etf/twse")}
        >
          返回 ETF 列表
        </Button>
      </Stack>

      <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
        我的最愛 ETF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        彙整已收藏 ETF
        的已儲存交易紀錄試算結果，點擊股號/名稱可查看該檔詳細資訊。
      </Typography>

      {!session && (
        <Alert severity="info">請先登入才能查看我的最愛 ETF。</Alert>
      )}

      {session && isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {session && !isLoading && rows.length === 0 && (
        <Alert severity="info">
          尚未加入任何最愛 ETF，到 ETF 列表點選星星圖示即可加入。
        </Alert>
      )}

      {session && !isLoading && rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>股號 / 名稱</TableCell>
                <TableCell align="right">目前持股數</TableCell>
                <TableCell align="right">最新收盤價</TableCell>
                <TableCell align="right">已實現盈虧</TableCell>
                <TableCell align="right">未實現盈虧</TableCell>
                <TableCell align="right">總盈虧</TableCell>
                <TableCell align="right">投入成本</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.code}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/data/etf/twse/${row.code}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {row.code} {row.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {row.result.finalShares.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </TableCell>
                  <TableCell align="right">
                    {formatAmount(row.latestClose)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: getTrendColor(row.result.realizedTotal) }}
                  >
                    {formatAmount(row.result.realizedTotal)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: getTrendColor(row.result.unrealizedTotal) }}
                  >
                    {formatAmount(row.result.unrealizedTotal)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: getTrendColor(row.result.grandTotal),
                      fontWeight: 700,
                    }}
                  >
                    {formatAmount(row.result.grandTotal)}
                  </TableCell>
                  <TableCell align="right">
                    {formatAmount(row.result.totalCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>總計</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {totals.finalShares.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </TableCell>
                <TableCell />
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    color: getTrendColor(totals.realizedTotal),
                  }}
                >
                  {formatAmount(totals.realizedTotal)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    color: getTrendColor(totals.unrealizedTotal),
                  }}
                >
                  {formatAmount(totals.unrealizedTotal)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    color: getTrendColor(totals.grandTotal),
                  }}
                >
                  {formatAmount(totals.grandTotal)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatAmount(totals.totalCost)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
