import type { EtfDistribution, EtfDivideInfo } from "@/types/etf.ts";
import type {
  ProfitDetailRow,
  ProfitResult,
  Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";

// 報酬率 = 損益 / 投入成本，成本為 0（例如還沒填任何交易紀錄）時回傳 null 而不是除以零。
// 匯出供「我的最愛」總覽頁算加總後的報酬率時重用同一套規則。
export function computeRate(gain: number, cost: number): number | null {
  return cost > 0 ? (gain / cost) * 100 : null;
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
export function calcTransactionsResult(
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
  const rateOf = (gain: number) => computeRate(gain, totalCost);

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
