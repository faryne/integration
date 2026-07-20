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
import type { EtfDivideInfo, EtfInfo } from "@/types/etf.ts";
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
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";
import { ProfitDetailTable } from "@/components/etf/etf_profit_calculator_detail.tsx";
import { ProfitSummary } from "@/components/etf/etf_profit_calculator_summary.tsx";
import { ProfitQuickSummary } from "@/components/etf/etf_profit_calculator_quick_summary.tsx";
import { calcTransactionsResult } from "@/components/etf/etf_profit_calculator_engine.ts";

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
  // 最近一筆收盤價，作為「當前股價」欄位的預設值，避免試算結果一開始就是全 0
  latestClosePrice?: number;
  // 初始要帶入的交易紀錄（例如使用者先前已登入儲存過的紀錄）
  initialTransactions?: Transaction[];
  // 有傳入時會顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫
  onSaveTransactions?: (records: Transaction[]) => Promise<void> | void;
}

export function EtfProfitCalculator({
  data,
  defaultCurrency = "USD",
  onFetchDailyPrice,
  latestClosePrice,
  initialTransactions,
  onSaveTransactions,
}: EtfProfitCalculatorProps) {
  const [currentPrice, setCurrentPrice] = useState<number>(
    () => latestClosePrice ?? 0,
  );
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

          <TransactionRecordsEditor
            records={records}
            onChange={setRecords}
            onSaveTransactions={onSaveTransactions}
          />

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
