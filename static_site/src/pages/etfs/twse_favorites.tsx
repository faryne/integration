import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useTitle } from "@/helpers/title.tsx";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  useSaveTwseEtfFavorite,
  useTwseEtfFavoritesBatch,
} from "@/apis/opendata/etf_favorites.ts";
import { useGetTwseEtfCodeList } from "@/apis/opendata/twse_etf.ts";
import { EtfDetailDialog } from "@/components/etf/etf_detail_dialog.tsx";
import {
  calcTransactionsResult,
  computeRate,
} from "@/components/etf/etf_profit_calculator_engine.ts";
import {
  formatCurrencyAmount,
  formatRate,
} from "@/components/etf/etf_profit_calculator_format.ts";
import type { ProfitResult } from "@/components/etf/etf_profit_calculator_types.ts";
import type { EtfDistribution } from "@/types/etf.ts";

// 台股慣例：正數紅、負數綠
const getTrendColor = (value: number) => {
  if (value === 0) return "text.primary";
  return value > 0 ? "#d32f2f" : "#2e7d32";
};

// 台幣沒有小數交易，損益/成本金額顯示一律取整數
const formatAmount = (amount: number) => formatCurrencyAmount("NT$", amount, 0);
// 股價本身是有小數的報價（例如 31.81），跟金額整數化是兩回事，維持 2 位小數
const formatPrice = (amount: number) => formatCurrencyAmount("NT$", amount, 2);

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

const columns = [
  { label: "代號", align: "left" as const },
  { label: "名稱", align: "left" as const },
  { label: "目前持股數", align: "right" as const },
  { label: "最新收盤價", align: "right" as const },
  {
    label: "已實現盈虧",
    align: "right" as const,
    tooltip: "除息日已過的配息 ＋ 已賣出部位的損益",
  },
  {
    label: "未實現盈虧",
    align: "right" as const,
    tooltip:
      "除息日未到的配息（若已公告金額） ＋ 未賣出部位的帳面損益（依最新收盤價估算）",
  },
  {
    label: "總盈虧",
    align: "right" as const,
    tooltip: "已實現盈虧 ＋ 未實現盈虧",
  },
  { label: "投入成本", align: "right" as const },
];

// 我的最愛 ETF 總覽：彙整每支已收藏 ETF 的已儲存交易紀錄，重用獲利試算的
// 計算引擎算出目前持股數、已實現/未實現/總盈虧與投入成本，列表 + 總計列呈現。
export default function TwseEtfFavoritesPage() {
  useTitle("我的最愛 ETF - Faryne 的實驗室");
  const navigate = useNavigate();
  const { session } = useAuth();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const codeListQuery = useGetTwseEtfCodeList();
  const etfByCode = useMemo(
    () => new Map((codeListQuery.data?.data ?? []).map((e) => [e.code, e])),
    [codeListQuery.data],
  );

  // 一支 API 同時拿回配息紀錄跟已儲存交易紀錄，取代原本各支收藏各打兩支 API
  // 的做法；收藏清單本身也直接從這支回應算出，不用再另外呼叫 useTwseEtfFavorites。
  const favoritesBatchQuery = useTwseEtfFavoritesBatch();
  const favoriteItems = favoritesBatchQuery.data ?? [];
  const favoritedCodes = useMemo(
    () => new Set(favoriteItems.map((item) => item.code)),
    [favoriteItems],
  );
  const saveFavoriteMutation = useSaveTwseEtfFavorite();
  const handleToggleFavorite = (code: string) => {
    saveFavoriteMutation.mutate({
      code,
      favorited: !favoritedCodes.has(code),
    });
  };

  const isLoading = favoritesBatchQuery.isLoading || codeListQuery.isLoading;

  const rows = useMemo<FavoriteRow[]>(
    () =>
      favoriteItems.map((item) => {
        const etf = etfByCode.get(item.code);
        const distributions: EtfDistribution[] = item.distributions.map(
          (s) => ({
            per_share: s.share,
            declared_date: s.ex_date,
            ex_date: s.ex_date,
            payable_date: s.payable_date,
            roc: -1, // 台股境內配息無 ROC 預扣退稅資料
          }),
        );
        const latestClose = etf?.latest_close ?? 0;
        return {
          code: item.code,
          name: etf?.name ?? item.code,
          latestClose,
          result: calcTransactionsResult(
            item.transactions,
            distributions,
            [],
            latestClose,
            0,
          ),
        };
      }),
    [favoriteItems, etfByCode],
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
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            overflowX: "auto",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
          }}
        >
          <Table stickyHeader size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ bgcolor: "#f6f9fc" }} />
                {columns.map((col) => (
                  <TableCell
                    key={col.label}
                    align={col.align}
                    sx={{
                      fontWeight: 900,
                      bgcolor: "#f6f9fc",
                      color: "text.secondary",
                    }}
                  >
                    {col.tooltip ? (
                      <Tooltip title={col.tooltip} arrow>
                        <Box
                          component="span"
                          sx={{
                            borderBottom: "1px dashed",
                            borderColor: "text.secondary",
                            cursor: "help",
                          }}
                        >
                          {col.label}
                        </Box>
                      </Tooltip>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.code}
                  hover
                  sx={{
                    "&:nth-of-type(even)": {
                      bgcolor: "rgba(2, 132, 199, 0.025)",
                    },
                    "&:hover": { bgcolor: "rgba(25, 118, 210, 0.06)" },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Tooltip
                      title={
                        favoritedCodes.has(row.code)
                          ? `將『${row.code} - ${row.name}』移出最愛`
                          : `將『${row.code} - ${row.name}』加入最愛`
                      }
                    >
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => handleToggleFavorite(row.code)}
                      >
                        {favoritedCodes.has(row.code) ? (
                          <StarIcon fontSize="small" />
                        ) : (
                          <StarBorderIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color="primary"
                      variant="outlined"
                      label={row.code}
                      size="small"
                      sx={{ fontWeight: 900, borderRadius: 1.25 }}
                      onClick={() => setSelectedCode(row.code)}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, maxWidth: 260 }}>
                    <Button
                      onClick={() => setSelectedCode(row.code)}
                      variant="text"
                      sx={{
                        justifyContent: "flex-start",
                        px: 0,
                        textAlign: "left",
                        fontWeight: 800,
                        textTransform: "none",
                      }}
                    >
                      {row.name}
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    {row.result.finalShares.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </TableCell>
                  <TableCell align="right">
                    {formatPrice(row.latestClose)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: getTrendColor(row.result.realizedTotal) }}
                  >
                    {formatAmount(row.result.realizedTotal)}
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ color: "inherit", opacity: 0.85 }}
                    >
                      {formatRate(row.result.realizedRate)}
                    </Typography>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: getTrendColor(row.result.unrealizedTotal) }}
                  >
                    {formatAmount(row.result.unrealizedTotal)}
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ color: "inherit", opacity: 0.85 }}
                    >
                      {formatRate(row.result.unrealizedRate)}
                    </Typography>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: getTrendColor(row.result.grandTotal),
                      fontWeight: 700,
                    }}
                  >
                    {formatAmount(row.result.grandTotal)}
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ color: "inherit", opacity: 0.85 }}
                    >
                      {formatRate(row.result.grandTotalRate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {formatAmount(row.result.totalCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={3}
                  sx={{ fontWeight: 900, bgcolor: "#f6f9fc" }}
                >
                  總計
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 900, bgcolor: "#f6f9fc" }}
                >
                  {totals.finalShares.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </TableCell>
                <TableCell sx={{ bgcolor: "#f6f9fc" }} />
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: getTrendColor(totals.realizedTotal),
                  }}
                >
                  {formatAmount(totals.realizedTotal)}
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "inherit", opacity: 0.85 }}
                  >
                    {formatRate(
                      computeRate(totals.realizedTotal, totals.totalCost),
                    )}
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: getTrendColor(totals.unrealizedTotal),
                  }}
                >
                  {formatAmount(totals.unrealizedTotal)}
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "inherit", opacity: 0.85 }}
                  >
                    {formatRate(
                      computeRate(totals.unrealizedTotal, totals.totalCost),
                    )}
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: getTrendColor(totals.grandTotal),
                  }}
                >
                  {formatAmount(totals.grandTotal)}
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "inherit", opacity: 0.85 }}
                  >
                    {formatRate(
                      computeRate(totals.grandTotal, totals.totalCost),
                    )}
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 900, bgcolor: "#f6f9fc" }}
                >
                  {formatAmount(totals.totalCost)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}

      {session && !isLoading && rows.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          align="center"
          sx={{ mt: 2, lineHeight: 1.5 }}
        >
          ⚠️
          以上結果不含券商手續費、證券交易稅（賣出時課徵）等交易成本，也未扣除單筆配息達起扣金額（目前為
          2 萬元）需負擔的二代健保補充保費（費率
          2.11%），實際損益會比試算結果更低。資料依每支 ETF
          已儲存的交易紀錄試算，僅供參考，不保證數據之即時性與準確性，實際損益請以券商帳單為準。
        </Typography>
      )}

      {selectedCode && (
        <EtfDetailDialog
          key={selectedCode}
          code={selectedCode}
          open={!!selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      )}
    </Box>
  );
}
