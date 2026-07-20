import type { Transaction } from "@/components/etf/etf_profit_calculator_types.ts";

export function getSoldShares(record: Transaction): number {
  return record.sells.reduce((sum, s) => sum + (s.sellShares || 0), 0);
}

export function isOversold(record: Transaction): boolean {
  return record.buyShares > 0 && getSoldShares(record) > record.buyShares;
}

export function isSellDateBeforeBuy(sellDate: string, buyDate: string) {
  return !!sellDate && !!buyDate && sellDate < buyDate;
}

// 交易紀錄是否有邏輯錯誤：賣出股數總和超過購入股數、或任一筆賣出日期早於購入日期
export function hasRecordError(record: Transaction): boolean {
  return (
    isOversold(record) ||
    record.sells.some((s) => isSellDateBeforeBuy(s.sellDate, record.buyDate))
  );
}
