import type { EtfDivideInfo } from "@/types/etf.ts";
import {
  roundShares,
  splitFactorBetween,
} from "@/components/etf/etf_profit_calculator_split.ts";
import type { Transaction } from "@/components/etf/etf_profit_calculator_types.ts";

// 已賣出股數（賣出當天的實際股數直接加總，給畫面顯示用）
export function getSoldShares(record: Transaction): number {
  return record.sells.reduce((sum, s) => sum + (s.sellShares || 0), 0);
}

// 已賣出股數換算回「買進當時」的基準：賣出前若有分割，賣出的實際股數要除回分割倍數
export function getSoldSharesAtBuyBasis(
  record: Transaction,
  splitEvents: EtfDivideInfo[],
): number {
  return record.sells.reduce(
    (sum, s) =>
      sum +
      (s.sellShares || 0) /
        splitFactorBetween(splitEvents, record.buyDate, s.sellDate || null),
    0,
  );
}

// 剩餘股數換算成目前的股數基準（買進後所有分割都套用）
export function getRemainingShares(
  record: Transaction,
  splitEvents: EtfDivideInfo[],
): number {
  const remaining = Math.max(
    0,
    roundShares(
      (record.buyShares || 0) - getSoldSharesAtBuyBasis(record, splitEvents),
    ),
  );
  return remaining * splitFactorBetween(splitEvents, record.buyDate, null);
}

// 反分割換算（例如 ÷ 1/7）的浮點誤差不該被當成超賣，比對前先取到小數 6 位
export function isOversold(
  record: Transaction,
  splitEvents: EtfDivideInfo[],
): boolean {
  return (
    record.buyShares > 0 &&
    roundShares(getSoldSharesAtBuyBasis(record, splitEvents)) > record.buyShares
  );
}

export function isSellDateBeforeBuy(sellDate: string, buyDate: string) {
  return !!sellDate && !!buyDate && sellDate < buyDate;
}

// 交易紀錄是否有邏輯錯誤：賣出股數總和超過購入股數、或任一筆賣出日期早於購入日期
export function hasRecordError(
  record: Transaction,
  splitEvents: EtfDivideInfo[],
): boolean {
  return (
    isOversold(record, splitEvents) ||
    record.sells.some((s) => isSellDateBeforeBuy(s.sellDate, record.buyDate))
  );
}
