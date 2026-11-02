import dayjs from "dayjs";

import type { EtfDistribution, EtfDivideInfo } from "@/types/etf.ts";
import {
  roundShares,
  splitFactorBetween,
} from "@/components/etf/etf_profit_calculator_split.ts";
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
  refundAmount: number; // 美股專屬的預估退稅，台股固定為 0
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
  // 用本地日期：toISOString() 是 UTC，台灣早上 8 點前會被當成前一天，除息日當天的配息會被誤判成未實現
  const today = dayjs().format("YYYY-MM-DD");

  let realizedDividend = 0;
  let unrealizedDividend = 0;
  let realizedRefund = 0;
  let unrealizedRefund = 0;
  let realizedPriceGain = 0;
  let unrealizedPriceGain = 0;
  let totalCost = 0;
  let holdingCost = 0;
  let finalShares = 0;

  // 配息依 ex_date 聚合（同一天多筆購入紀錄命中會合併成一列）；賣出則每筆各自一列
  const dividendAgg = new Map<string, DividendAgg>();
  const sellRows: ProfitDetailRow[] = [];

  records.forEach((rec) => {
    if (!rec.buyDate || !rec.buyShares) return;

    // 買進到今天累積的分割倍數，用來把剩餘部位換算成目前的股數基準
    const factor = splitFactorBetween(splitEvents, rec.buyDate, null);
    const buyShares = Number(rec.buyShares);
    totalCost += rec.buyPrice * buyShares; // 投入成本以原始購買金額計算，不受分割影響

    const processDistributions = (
      shares: number,
      fromDate: string,
      toDate: string | null,
    ) => {
      if (shares <= 0) return;

      // 配息資格：除息日「前」就持有（除息日當天才買不算），且除息日當天或之後才賣（除息日當天賣出仍可領）。
      // 所以持有區間是 (fromDate, toDate]，前後段區間剛好接得起來不會重複計算。
      distributions
        .filter(
          (d) => d.ex_date > fromDate && (toDate ? d.ex_date <= toDate : true),
        )
        .forEach((d) => {
          // 除息當下實際持有的股數：只乘買進後、除息日（含）前已生效的分割
          const sharesHeld =
            shares * splitFactorBetween(splitEvents, rec.buyDate, d.ex_date);
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
            existing.refundAmount += refund;
          } else {
            dividendAgg.set(d.ex_date, {
              exDate: d.ex_date,
              shares: sharesHeld,
              perShare: d.per_share,
              grossAmount: currentAmount,
              netAmount,
              refundAmount: refund,
              realized: isRealized,
            });
          }
        });
    };

    // 一筆購入可以分好幾次賣出：依賣出日期排序後，切成一段一段的持有區間，
    // 每段區間內實際持有的股數 = 原始股數扣掉「這段之前」已經賣掉的部分。
    // 例如買 4000 股分 3 次賣：(買進, 賣1] 持有 4000、(賣1, 賣2] 持有 3500...
    // 最後一段 [最後一次賣出, 現在] 持有的就是還沒賣掉的剩餘股數。
    // 持有區間的股數一律用「買進當時」的基準記，賣出股數／價格則是賣出當天的實際數字
    // （跟券商對帳單一致），中間有分割時要換算回買進基準。
    const sortedSells = rec.sells
      .filter((s) => s.sellDate && s.sellShares > 0)
      .sort((a, b) => a.sellDate.localeCompare(b.sellDate));

    const adjCost = rec.buyPrice / factor;
    let cumulativeSold = 0;
    let windowStart = rec.buyDate;

    sortedSells.forEach((sell) => {
      const sharesHeldInWindow = buyShares - cumulativeSold;
      processDistributions(sharesHeldInWindow, windowStart, sell.sellDate);

      const sellFactor = splitFactorBetween(
        splitEvents,
        rec.buyDate,
        sell.sellDate,
      );
      const costAtSell = rec.buyPrice / sellFactor;
      const sellShares = Number(sell.sellShares);
      const gain = (Number(sell.sellPrice) - costAtSell) * sellShares;
      realizedPriceGain += gain;
      sellRows.push({
        id: `sell-${rec.id}-${sell.id}`,
        date: sell.sellDate,
        type: "sell",
        description: `購入價 ${costAtSell.toFixed(4)} → 賣出 ${sellShares.toLocaleString()} 股 @ ${Number(sell.sellPrice).toFixed(4)}`,
        grossAmount: gain,
        netAmount: null,
        refundAmount: null,
        realized: true,
      });

      cumulativeSold += sellShares / sellFactor;
      windowStart = sell.sellDate;
    });

    const remainingShares = Math.max(
      0,
      roundShares(buyShares - cumulativeSold),
    );
    processDistributions(remainingShares, windowStart, null);

    // 未處分（帳面）損益：買價需依分割因子換算成目前股數基準下的成本
    unrealizedPriceGain +=
      (currentPrice - adjCost) * (remainingShares * factor);
    finalShares += remainingShares * factor;
    // 持有成本只算還沒賣掉的股數；已賣出部分的成本已經反映在已實現損益裡
    holdingCost += rec.buyPrice * remainingShares;
  });

  const dividendRows: ProfitDetailRow[] = Array.from(dividendAgg.values()).map(
    (d) => ({
      id: `dividend-${d.exDate}`,
      date: d.exDate,
      type: "dividend",
      description: `持有 ${d.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} 股 × 每股 ${d.perShare.toFixed(4)}`,
      grossAmount: d.grossAmount,
      netAmount: d.netAmount,
      refundAmount: d.refundAmount > 0 ? d.refundAmount : null,
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
    holdingCost,
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
    // 未實現只跟手上還沒賣的部位有關，分母用持有成本；用累計投入成本會被已賣出的部分稀釋
    unrealizedRate: computeRate(unrealizedTotal, holdingCost),
    grandTotalRate: rateOf(grandTotal),
  };
}
