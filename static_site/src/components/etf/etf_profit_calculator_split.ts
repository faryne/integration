import type { EtfDivideInfo } from "@/types/etf.ts";

// 反分割比率（例如 7 合 1 = 0.1428571429）換算回買進基準會有浮點誤差，賣光時會剩 3e-7 股；
// 股數取到小數 6 位就夠（美股零股最多到小數 5～6 位），順便把這種殘值歸零
export function roundShares(shares: number): number {
  return Math.round(shares * 1e6) / 1e6;
}

// 反分割比率在 DB 只存到小數 10 位（7 合 1 = 0.1428571429），股數一多誤差就會放大；
// 倒數接近整數時還原成精確的 1/n
function normalizeRatio(ratio: number): number {
  if (ratio >= 1) return ratio;
  const n = Math.round(1 / ratio);
  return Math.abs(1 / ratio - n) < 1e-6 ? 1 / n : ratio;
}

// 區間 (fromDate, toDate] 內生效的分割/反分割累乘倍數，toDate 為 null 代表一路算到現在。
// 生效日是「恢復買賣日」：當天起股數與價格都已是分割後的基準，所以當天買進不用換算，
// 當天除息、賣出則要換算。配息金額（證交所、YieldMax 官網）都是當時的原始金額、不會
// 回溯調整，因此換算時只能乘「到那一天為止」發生過的分割，不能直接乘到今天。
export function splitFactorBetween(
  splitEvents: EtfDivideInfo[],
  fromDate: string,
  toDate: string | null,
): number {
  return splitEvents
    .filter(
      (e) =>
        e.date &&
        e.ratio > 0 &&
        e.date > fromDate &&
        (toDate === null || e.date <= toDate),
    )
    .reduce((acc, e) => acc * normalizeRatio(e.ratio), 1);
}
