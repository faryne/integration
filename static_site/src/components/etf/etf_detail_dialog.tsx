import { useCallback, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { EtfInfo, TwseEtfInfo, TwseEtfShare } from "@/types/etf.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  useSaveTwseEtfFavorite,
  useTwseEtfFavorites,
} from "@/apis/opendata/etf_favorites.ts";
import {
  useSaveTwseEtfTransactions,
  useTwseEtfSavedTransactions,
} from "@/apis/opendata/etf_transactions.ts";
import {
  fetchTwseEtfDailyTicker,
  useGetTwseEtfCodeList,
  useGetTwseEtfInfo,
} from "@/apis/opendata/twse_etf.ts";
import { buildSnsShareUrl, shareUrl } from "@/helpers/share.ts";
import { DetailDialog } from "@/components/common/DetailDialog.tsx";
import {
  EtfProfitCalculator,
  type DailyPriceQuote,
} from "@/components/etf/etf_profit_calculator.tsx";
import { EtfCandleChart } from "@/components/etf/etf_candle_chart.tsx";
import { DetailStat } from "@/components/etf/etf_detail_stat.tsx";
import {
  formatDateOrDash,
  getWinRateTone,
} from "@/pages/etfs/twse_format_helpers.ts";

const EtfDetailSummary = ({ etf }: { etf: TwseEtfInfo }) => (
  <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
    <DetailStat label="總除息次數" value={etf.total_ex_count || "--"} />
    <DetailStat label="成功填息" value={etf.success_fill_count || "--"} />
    <DetailStat
      label="勝率"
      value={etf.win_rate > 0 ? `${etf.win_rate}%` : "--"}
      tone={getWinRateTone(etf.win_rate)}
    />
    <DetailStat label="平均填息日" value={etf.avg_fill_days || "--"} />
    <DetailStat label="最近除息日" value={formatDateOrDash(etf.ex_date)} />
  </Stack>
);

const EtfHistoryShare = ({ data }: { data: TwseEtfShare[] }) => (
  <>
    <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 2 }}>
      歷史配息紀錄
    </Typography>
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, overflowX: "auto" }}
    >
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            {[
              "除息日期",
              "入帳日期",
              "配息金額",
              "單次殖利率",
              "填息日",
              "填息所需日曆日",
            ].map((label) => (
              <TableCell
                key={label}
                align={label === "配息金額" ? "right" : "left"}
                sx={{
                  bgcolor: "#f6f9fc",
                  color: "text.secondary",
                  fontWeight: 900,
                }}
              >
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(data || []).map((record, index) => (
            <TableRow key={index}>
              <TableCell>{formatDateOrDash(record.ex_date)}</TableCell>
              <TableCell>{formatDateOrDash(record.payable_date)}</TableCell>
              <TableCell
                align="right"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {record.share > 0 ? record.share.toFixed(4) : "--"}
              </TableCell>
              <TableCell>
                {record.yield_rate > 0 ? record.yield_rate + "%" : "--"}
              </TableCell>
              <TableCell>{formatDateOrDash(record.filled_date)}</TableCell>
              <TableCell>
                {record.filled_days > 0 ? record.filled_days : "--"}
              </TableCell>
            </TableRow>
          ))}
          {!data ||
            (data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  尚無配息資料
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  </>
);

export interface EtfDetailDialogProps {
  code: string;
  open: boolean;
  onClose: () => void;
}

// 自成一體的 ETF 詳細資訊 dialog：只靠 code 就能獨立運作（內部自己抓資料、
// 自己管理最愛/分享/分頁狀態），可以放進任何頁面使用，不用透過路由帶 code 才能開。
// twse.tsx 的列表頁跟「我的最愛」總覽頁都用這個元件；React Query 用一樣的
// queryKey，即使兩邊各自呼叫同一個 hook 也只會共用快取、不會重複打 API。
export function EtfDetailDialog({ code, open, onClose }: EtfDetailDialogProps) {
  const [dialogTabValue, setDialogTabValue] = useState(0);
  const [shareNotice, setShareNotice] = useState("");

  const codeListQuery = useGetTwseEtfCodeList();
  const etf = useMemo(
    () => codeListQuery.data?.data?.find((e) => e.code === code) ?? null,
    [codeListQuery.data, code],
  );

  const { session } = useAuth();
  const favoritesQuery = useTwseEtfFavorites();
  const favoritedCodes = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.code)),
    [favoritesQuery.data],
  );
  const saveFavoriteMutation = useSaveTwseEtfFavorite();
  const handleToggleFavorite = useCallback(() => {
    saveFavoriteMutation.mutate({
      code,
      favorited: !favoritedCodes.has(code),
    });
  }, [code, favoritedCodes, saveFavoriteMutation]);

  const queryShares = useGetTwseEtfInfo(code);
  const profitCalculatorData = useMemo<EtfInfo>(
    () => ({
      code,
      description: etf?.name ?? "",
      distributions: (queryShares.data?.data?.stats ?? []).map((s) => ({
        per_share: s.share,
        declared_date: formatDateOrDash(s.ex_date),
        ex_date: formatDateOrDash(s.ex_date),
        payable_date: formatDateOrDash(s.payable_date),
        roc: -1, // 台股境內配息無 ROC 預扣退稅資料
      })),
    }),
    [code, etf, queryShares.data],
  );
  const handleFetchDailyPrice = useCallback(
    async (date: string): Promise<DailyPriceQuote | null> => {
      const row = await fetchTwseEtfDailyTicker(code, date);
      if (!row) return null;
      return { open: row.open, high: row.max, low: row.min, close: row.close };
    },
    [code],
  );

  const isProfitTabOpen = dialogTabValue === 2;
  const savedTransactionsQuery = useTwseEtfSavedTransactions(
    code,
    isProfitTabOpen,
  );
  const saveTransactionsMutation = useSaveTwseEtfTransactions(code);
  // 已登入時要等已儲存的交易紀錄抓回來才 mount 試算元件，讓 initialTransactions 有正確初始值
  const canRenderProfitCalculator =
    isProfitTabOpen &&
    (!session ||
      savedTransactionsQuery.isSuccess ||
      savedTransactionsQuery.isError);

  const handleShare = async () => {
    const result = await shareUrl({
      url: buildSnsShareUrl(`/data/etf/twse/${code}`),
    });

    if (result === "copied") {
      setShareNotice("連結已複製");
    }

    if (result === "failed") {
      setShareNotice("無法分享連結");
    }
  };

  if (!etf) {
    return null;
  }

  return (
    <>
      <DetailDialog
        open={open}
        badge={etf.code}
        title={etf.name}
        onClose={onClose}
        onShare={() => void handleShare()}
        shareLabel="分享 ETF 連結"
        favorite={
          session
            ? {
                isFavorited: favoritedCodes.has(etf.code),
                onToggle: handleToggleFavorite,
                label: favoritedCodes.has(etf.code)
                  ? `將『${etf.code} - ${etf.name}』移出最愛`
                  : `將『${etf.code} - ${etf.name}』加入最愛`,
              }
            : undefined
        }
      >
        <EtfDetailSummary etf={etf} />
        <Tabs
          value={dialogTabValue}
          onChange={(_, newValue) => setDialogTabValue(newValue)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1 }}
        >
          <Tab label={"配息紀錄"} />
          <Tab label={"歷史股價"} />
          <Tab label={"獲利試算"} />
        </Tabs>
        <Divider />
        <Box sx={{ display: dialogTabValue === 0 ? "block" : "none" }}>
          <EtfHistoryShare data={queryShares.data?.data?.stats ?? []} />
        </Box>
        <Box sx={{ display: dialogTabValue === 1 ? "block" : "none" }}>
          {dialogTabValue === 1 && (
            <EtfCandleChart etfCode={etf.code} etfName={etf.name} />
          )}
        </Box>
        <Box sx={{ display: isProfitTabOpen ? "block" : "none" }}>
          {canRenderProfitCalculator ? (
            <EtfProfitCalculator
              data={profitCalculatorData}
              defaultCurrency="TWD"
              onFetchDailyPrice={handleFetchDailyPrice}
              latestClosePrice={etf.latest_close}
              initialTransactions={
                session ? savedTransactionsQuery.data : undefined
              }
              onSaveTransactions={
                session
                  ? (records) => saveTransactionsMutation.mutateAsync(records)
                  : undefined
              }
            />
          ) : (
            isProfitTabOpen && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            )
          )}
        </Box>
      </DetailDialog>
      <Snackbar
        open={!!shareNotice}
        autoHideDuration={2000}
        onClose={() => setShareNotice("")}
        message={shareNotice}
      />
    </>
  );
}
