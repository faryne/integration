import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { EtfDistribution, EtfDivideInfo, EtfInfo } from "@/types/etf.ts";
import {
  SplitEventsEditor,
  type SplitEventRow,
} from "@/components/etf/etf_profit_calculator_split_events.tsx";
import {
  PriceQueryPanel,
  type DailyPriceQuote,
} from "@/components/etf/etf_profit_calculator_price_query.tsx";
import { TransactionRecordsEditor } from "@/components/etf/etf_profit_calculator_transactions.tsx";
import {
  emptyTransaction,
  type DistributionBreakdownRow,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";
import { ProfitBreakdownTable } from "@/components/etf/etf_profit_calculator_breakdown.tsx";
import { ProfitSummary } from "@/components/etf/etf_profit_calculator_summary.tsx";

export type { DailyPriceQuote };

// 紅漲綠跌 (台) / 綠漲紅跌 (美)：純粹是使用者習慣的顯示風格，跟計價貨幣無關
type DisplayStyle = "TW" | "US";
type Currency = "USD" | "TWD";

const CURRENCY_META: Record<Currency, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "USD" },
  TWD: { symbol: "NT$", label: "TWD" },
};

export interface EtfProfitCalculatorProps {
  data: EtfInfo;
  // 計價貨幣：美股 ETF 預設 USD，台股 ETF 應傳入 TWD
  defaultCurrency?: Currency;
  // 依日期取得當日開高低收，供使用者挑選帶入「當前股價」；不同資料來源需自行實作
  onFetchDailyPrice?: (date: string) => Promise<DailyPriceQuote | null>;
  // 階段式算法初始要帶入的交易紀錄（例如使用者先前已登入儲存過的紀錄）
  initialTransactions?: Transaction[];
  // 有傳入時，階段式算法會顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫
  onSaveTransactions?: (records: Transaction[]) => Promise<void> | void;
}

// 計算單一批次交易（原始股數 + 分割紀錄）在截至目前為止的配息與價差損益
// withholdingRate：美股 NRA 預扣稅率 (YieldMax 等美股 ETF 為 0.3)；台股境內配息無此預扣機制，應傳入 0
function calcTransactionsResult(
  records: Transaction[],
  distributions: EtfDistribution[],
  splitEvents: EtfDivideInfo[],
  currentPrice: number,
  withholdingRate: number,
) {
  const getCumulativeFactor = (startDate: string) => {
    if (!startDate) return 1;
    return splitEvents
      .filter(
        (event) => event.date && event.ratio > 0 && event.date > startDate,
      )
      .reduce((acc, event) => acc * event.ratio, 1);
  };

  let totalDiv = 0;
  let totalPriceGain = 0;
  let totalRefund = 0;
  let totalCost = 0;
  let finalShares = 0;
  const breakdownByExDate = new Map<string, DistributionBreakdownRow>();

  records.forEach((rec) => {
    if (!rec.buyDate || !rec.buyShares) return;

    const factor = getCumulativeFactor(rec.buyDate);
    const buyShares = Number(rec.buyShares);
    totalCost += rec.buyPrice * buyShares; // 投入成本以原始購買金額計算，不受分割影響

    const processDistributions = (
      shares: number,
      fromDate: string,
      toDate: string | null,
    ) => {
      if (shares <= 0) return;

      distributions
        .filter(
          (d) => d.ex_date >= fromDate && (toDate ? d.ex_date < toDate : true),
        )
        .forEach((d) => {
          const sharesHeld = shares * factor;
          const currentAmount = d.per_share * sharesHeld;
          const netAmount = currentAmount * (1 - withholdingRate);
          totalDiv += netAmount;
          if (withholdingRate > 0 && d.roc > 0) {
            totalRefund += currentAmount * withholdingRate * (d.roc / 100);
          }

          const existing = breakdownByExDate.get(d.ex_date);
          if (existing) {
            existing.shares += sharesHeld;
            existing.grossAmount += currentAmount;
            existing.netAmount += netAmount;
          } else {
            breakdownByExDate.set(d.ex_date, {
              exDate: d.ex_date,
              payableDate: d.payable_date,
              shares: sharesHeld,
              perShare: d.per_share,
              grossAmount: currentAmount,
              netAmount,
            });
          }
        });
    };

    // 一筆購入可以分好幾次賣出：依賣出日期排序後，切成一段一段的持有區間，
    // 每段區間內實際持有的股數 = 原始股數扣掉「這段之前」已經賣掉的部分。
    // 例如買 4000 股分 3 次賣：[買進, 賣1) 持有 4000、[賣1, 賣2) 持有 3500...
    // 最後一段 [最後一次賣出, 現在] 持有的就是還沒賣掉的剩餘股數。
    const sortedSells = rec.sells
      .filter((s) => s.sellDate && s.sellShares > 0)
      .sort((a, b) => a.sellDate.localeCompare(b.sellDate));

    const adjCost = rec.buyPrice / factor;
    let cumulativeSold = 0;
    let windowStart = rec.buyDate;
    let realizedGain = 0;

    sortedSells.forEach((sell) => {
      const sharesHeldInWindow = buyShares - cumulativeSold;
      processDistributions(sharesHeldInWindow, windowStart, sell.sellDate);

      const sellShares = Number(sell.sellShares);
      realizedGain +=
        (Number(sell.sellPrice) - adjCost) * (sellShares * factor);
      cumulativeSold += sellShares;
      windowStart = sell.sellDate;
    });

    const remainingShares = buyShares - cumulativeSold;
    processDistributions(remainingShares, windowStart, null);

    // 價差損益：買價需依分割因子換算成目前股數基準下的成本
    const unrealizedGain =
      (currentPrice - adjCost) * (remainingShares * factor);
    totalPriceGain += realizedGain + unrealizedGain;
    finalShares += remainingShares * factor;
  });

  const breakdown = Array.from(breakdownByExDate.values()).sort((a, b) =>
    a.exDate.localeCompare(b.exDate),
  );

  const total = totalDiv + totalPriceGain;
  const totalWithRefund = total + totalRefund;
  const rateOf = (gain: number) =>
    totalCost > 0 ? (gain / totalCost) * 100 : null;

  return {
    totalDiv,
    totalPriceGain,
    totalRefund,
    totalCost,
    total,
    totalWithRefund,
    breakdown,
    finalShares,
    // 未含息盈虧率：純股價漲跌相對投入成本的報酬率
    priceOnlyRate: rateOf(totalPriceGain),
  };
}

export function EtfProfitCalculator({
  data,
  defaultCurrency = "USD",
  onFetchDailyPrice,
  initialTransactions,
  onSaveTransactions,
}: EtfProfitCalculatorProps) {
  const [tab, setTab] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("TW");

  const currency = CURRENCY_META[defaultCurrency];
  // 美股 ETF (如 YieldMax) 配息需預扣 30% NRA 稅款，次年可依 ROC 比例申請退稅；
  // 台股境內配息無此預扣機制，故 TWD 一律不套用
  const withholdingRate = defaultCurrency === "USD" ? 0.3 : 0;

  // 分割/反分割紀錄：以 ETF 資料內建的紀錄為初始值，使用者可自行增減調整
  const [splitEventRows, setSplitEventRows] = useState<SplitEventRow[]>(() =>
    (data.divided_info ?? []).map((event, index) => ({
      id: `seed-${index}`,
      ...event,
    })),
  );
  const splitEvents = useMemo<EtfDivideInfo[]>(
    () => splitEventRows.map(({ date, ratio }) => ({ date, ratio })),
    [splitEventRows],
  );

  // 簡式狀態：以「購買當下」的原始股數輸入，內部會依分割紀錄換算至目前股數
  const [simpleShares, setSimpleShares] = useState<number>(0);
  const [simpleAvgCost, setSimpleAvgCost] = useState<number>(0);
  const [simpleStartDate, setSimpleStartDate] = useState<string>("");

  // 階段式狀態：有帶入已儲存的紀錄就用那份，否則維持一列空白列
  const [records, setRecords] = useState<Transaction[]>(() =>
    initialTransactions && initialTransactions.length > 0
      ? initialTransactions
      : [emptyTransaction("1")],
  );

  const getTrendColor = (value: number) => {
    if (value === 0) return "text.primary";
    const isPositive = value > 0;
    if (displayStyle === "TW") {
      return isPositive ? "#d32f2f" : "#2e7d32"; // 台股：正數紅、負數綠
    }
    return isPositive ? "#2e7d32" : "#d32f2f"; // 美股：正數綠、負數紅
  };

  const simpleRecord = useMemo<Transaction>(
    () => ({
      id: "simple",
      buyDate: simpleStartDate,
      buyShares: simpleShares,
      buyPrice: simpleAvgCost,
      sells: [],
    }),
    [simpleStartDate, simpleShares, simpleAvgCost],
  );

  const simpleResult = useMemo(
    () =>
      calcTransactionsResult(
        [simpleRecord],
        data.distributions,
        splitEvents,
        currentPrice,
        withholdingRate,
      ),
    [
      simpleRecord,
      data.distributions,
      splitEvents,
      currentPrice,
      withholdingRate,
    ],
  );

  const tieredResult = useMemo(
    () =>
      calcTransactionsResult(
        records,
        data.distributions,
        splitEvents,
        currentPrice,
        withholdingRate,
      ),
    [records, data.distributions, splitEvents, currentPrice, withholdingRate],
  );

  const result = tab === 0 ? simpleResult : tieredResult;
  // 最終盈虧：美股需扣除預扣稅款 (含息總損益)，台股無預扣直接採用含息總額
  const finalAmount =
    withholdingRate > 0 ? result.total : result.totalWithRefund;
  const finalRate =
    result.totalCost > 0 ? (finalAmount / result.totalCost) * 100 : null;

  return (
    <Card
      sx={{
        mb: 4,
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgColor: "#f8f9fa" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab label="簡式算法 (Total)" />
          <Tab label="階段式算法 (Tiered)" />
        </Tabs>
      </Box>

      <CardContent sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2" color="text.secondary">
              顯示風格：
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={displayStyle}
              exclusive
              onChange={(_, v) => v && setDisplayStyle(v)}
            >
              <ToggleButton value="TW" sx={{ px: 2 }}>
                紅漲綠跌 (台)
              </ToggleButton>
              <ToggleButton value="US" sx={{ px: 2 }}>
                綠漲紅跌 (美)
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack spacing={1}>
            <TextField
              label={`當前股價 (${currency.label})`}
              type="number"
              size="small"
              fullWidth
              value={currentPrice || ""}
              onChange={(e) => setCurrentPrice(Number(e.target.value))}
              helperText={
                splitEvents.length > 0
                  ? `* 已套用 ${splitEvents.map((o) => o.date).join("、")} 等日期的分割/反分割因子，請對照下方紀錄確認是否正確。`
                  : ""
              }
            />
            {onFetchDailyPrice && (
              <PriceQueryPanel
                currencyCode={currency.label}
                selectedPrice={currentPrice}
                onFetchDailyPrice={onFetchDailyPrice}
                onSelectPrice={setCurrentPrice}
              />
            )}
          </Stack>

          <SplitEventsEditor
            rows={splitEventRows}
            onChange={setSplitEventRows}
          />

          <Divider />

          {tab === 0 ? (
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="購買日期"
                  type="date"
                  fullWidth
                  size="small"
                  value={simpleStartDate}
                  onChange={(e) => setSimpleStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="需填寫才能正確套用分割/反分割因子與篩選配息紀錄"
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="購買當下股數"
                  type="number"
                  fullWidth
                  size="small"
                  value={simpleShares || ""}
                  onChange={(e) => setSimpleShares(Number(e.target.value))}
                  helperText="輸入購買當下的原始股數，系統會依分割紀錄換算至目前股數"
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="購買當下平均成本"
                  type="number"
                  fullWidth
                  size="small"
                  value={simpleAvgCost || ""}
                  onChange={(e) => setSimpleAvgCost(Number(e.target.value))}
                />
              </Grid>
            </Grid>
          ) : (
            <TransactionRecordsEditor
              records={records}
              onChange={setRecords}
              onSaveTransactions={onSaveTransactions}
            />
          )}

          <Divider />

          <ProfitSummary
            result={result}
            currencySymbol={currency.symbol}
            withholdingRate={withholdingRate}
            finalAmount={finalAmount}
            finalRate={finalRate}
            getTrendColor={getTrendColor}
          />

          <ProfitBreakdownTable
            rows={result.breakdown}
            currencySymbol={currency.symbol}
            showNetAmount={withholdingRate > 0}
          />

          <Divider sx={{ my: 2 }} />

          <Box sx={{ px: 1, opacity: 0.7 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              align="center"
              sx={{ lineHeight: 1.5 }}
            >
              ⚠️
              免責聲明：本工具提供之試算結果（含配息、價差及權值調整）僅供參考，不保證數據之即時性與準確性。
              實際損益請以券商帳單為準。投資標的過去績效不代表未來表現，使用者應獨立評估風險並自負投資損益。
            </Typography>
          </Box>

          {onSaveTransactions && (
            <Box sx={{ px: 1, opacity: 0.7 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                align="center"
                sx={{ lineHeight: 1.5 }}
              >
                🔒
                儲存聲明：階段式算法的交易紀錄若選擇「同意並儲存」，會與您的帳號綁定保存，下次開啟本頁時自動載入，不需要重新輸入。
                這些紀錄僅供您本人試算使用，不會公開顯示，也不會提供給其他使用者或第三方查看您的持倉內容。
                您可以隨時修改後重新儲存以覆蓋舊資料。
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
