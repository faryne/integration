import { useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
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
  type ProfitDetailRow,
  type ProfitResult,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";
import { ProfitDetailTable } from "@/components/etf/etf_profit_calculator_detail.tsx";
import { ProfitSummary } from "@/components/etf/etf_profit_calculator_summary.tsx";
import { ProfitQuickSummary } from "@/components/etf/etf_profit_calculator_quick_summary.tsx";

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
  // 初始要帶入的交易紀錄（例如使用者先前已登入儲存過的紀錄）
  initialTransactions?: Transaction[];
  // 有傳入時會顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫
  onSaveTransactions?: (records: Transaction[]) => Promise<void> | void;
}

interface DividendAgg {
  exDate: string;
  shares: number;
  perShare: number;
  grossAmount: number;
  netAmount: number;
  realized: boolean;
}

// 計算全部交易紀錄（原始股數 + 分割紀錄 + 賣出）截至目前為止的損益，並拆成
// 已實現（除息日已過的配息、已賣出部分的損益）跟未實現（除息日未到的配息、
// 未賣出部位的帳面損益）兩塊。
// withholdingRate：美股 NRA 預扣稅率 (YieldMax 等美股 ETF 為 0.3)；台股境內配息無此預扣機制，應傳入 0
function calcTransactionsResult(
  records: Transaction[],
  distributions: EtfDistribution[],
  splitEvents: EtfDivideInfo[],
  currentPrice: number,
  withholdingRate: number,
): ProfitResult {
  const today = new Date().toISOString().slice(0, 10);

  const getCumulativeFactor = (startDate: string) => {
    if (!startDate) return 1;
    return splitEvents
      .filter(
        (event) => event.date && event.ratio > 0 && event.date > startDate,
      )
      .reduce((acc, event) => acc * event.ratio, 1);
  };

  let realizedDividend = 0;
  let unrealizedDividend = 0;
  let realizedRefund = 0;
  let unrealizedRefund = 0;
  let realizedPriceGain = 0;
  let unrealizedPriceGain = 0;
  let totalCost = 0;
  let finalShares = 0;

  // 配息依 ex_date 聚合（同一天多筆購入紀錄命中會合併成一列）；賣出則每筆各自一列
  const dividendAgg = new Map<string, DividendAgg>();
  const sellRows: ProfitDetailRow[] = [];

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
          const refund =
            withholdingRate > 0 && d.roc > 0
              ? currentAmount * withholdingRate * (d.roc / 100)
              : 0;
          const isRealized = d.ex_date <= today;

          if (isRealized) {
            realizedDividend += netAmount;
            realizedRefund += refund;
          } else {
            unrealizedDividend += netAmount;
            unrealizedRefund += refund;
          }

          const existing = dividendAgg.get(d.ex_date);
          if (existing) {
            existing.shares += sharesHeld;
            existing.grossAmount += currentAmount;
            existing.netAmount += netAmount;
          } else {
            dividendAgg.set(d.ex_date, {
              exDate: d.ex_date,
              shares: sharesHeld,
              perShare: d.per_share,
              grossAmount: currentAmount,
              netAmount,
              realized: isRealized,
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

    sortedSells.forEach((sell) => {
      const sharesHeldInWindow = buyShares - cumulativeSold;
      processDistributions(sharesHeldInWindow, windowStart, sell.sellDate);

      const sellShares = Number(sell.sellShares);
      const gain = (Number(sell.sellPrice) - adjCost) * (sellShares * factor);
      realizedPriceGain += gain;
      sellRows.push({
        id: `sell-${rec.id}-${sell.id}`,
        date: sell.sellDate,
        type: "sell",
        description: `購入價 ${adjCost.toFixed(4)} → 賣出 ${sellShares.toLocaleString()} 股 @ ${Number(sell.sellPrice).toFixed(4)}`,
        grossAmount: gain,
        netAmount: null,
        realized: true,
      });

      cumulativeSold += sellShares;
      windowStart = sell.sellDate;
    });

    const remainingShares = buyShares - cumulativeSold;
    processDistributions(remainingShares, windowStart, null);

    // 未處分（帳面）損益：買價需依分割因子換算成目前股數基準下的成本
    unrealizedPriceGain +=
      (currentPrice - adjCost) * (remainingShares * factor);
    finalShares += remainingShares * factor;
  });

  const dividendRows: ProfitDetailRow[] = Array.from(dividendAgg.values()).map(
    (d) => ({
      id: `dividend-${d.exDate}`,
      date: d.exDate,
      type: "dividend",
      description: `持有 ${d.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} 股 × 每股 ${d.perShare.toFixed(4)}`,
      grossAmount: d.grossAmount,
      netAmount: d.netAmount,
      realized: d.realized,
    }),
  );

  const detail = [...dividendRows, ...sellRows].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const realizedTotal = realizedDividend + realizedPriceGain + realizedRefund;
  const unrealizedTotal =
    unrealizedDividend + unrealizedPriceGain + unrealizedRefund;
  const grandTotal = realizedTotal + unrealizedTotal;
  const rateOf = (gain: number) =>
    totalCost > 0 ? (gain / totalCost) * 100 : null;

  return {
    totalCost,
    finalShares,
    detail,
    realizedDividend,
    realizedPriceGain,
    realizedRefund,
    realizedTotal,
    unrealizedDividend,
    unrealizedPriceGain,
    unrealizedRefund,
    unrealizedTotal,
    grandTotal,
    realizedRate: rateOf(realizedTotal),
    unrealizedRate: rateOf(unrealizedTotal),
    grandTotalRate: rateOf(grandTotal),
  };
}

export function EtfProfitCalculator({
  data,
  defaultCurrency = "USD",
  onFetchDailyPrice,
  initialTransactions,
  onSaveTransactions,
}: EtfProfitCalculatorProps) {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("TW");
  const detailRef = useRef<HTMLDivElement>(null);

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

  // 交易紀錄：有帶入已儲存的紀錄就用那份，否則維持一列空白列
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

  const result = useMemo(
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

  return (
    <Card
      sx={{
        mb: 4,
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
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

                <TransactionRecordsEditor
                  records={records}
                  onChange={setRecords}
                  onSaveTransactions={onSaveTransactions}
                />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <ProfitQuickSummary
                result={result}
                currencySymbol={currency.symbol}
                getTrendColor={getTrendColor}
                onJumpToDetail={() =>
                  detailRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              />
            </Grid>
          </Grid>

          <Divider />

          <Stack spacing={3} ref={detailRef}>
            <ProfitSummary
              result={result}
              currencySymbol={currency.symbol}
              withholdingRate={withholdingRate}
              getTrendColor={getTrendColor}
            />

            <ProfitDetailTable
              rows={result.detail}
              currencySymbol={currency.symbol}
              showNetAmount={withholdingRate > 0}
              getTrendColor={getTrendColor}
            />
          </Stack>

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
