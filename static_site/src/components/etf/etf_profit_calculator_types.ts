// 同一筆購入批次可以分好幾次賣出（例如買 4000 股後分 3 次賣掉不同股數/價格）
export interface SellEvent {
  id: string;
  sellDate: string;
  sellShares: number;
  sellPrice: number;
}

export interface Transaction {
  id: string;
  buyDate: string;
  buyShares: number; // 原始購入股數
  buyPrice: number;
  sells: SellEvent[]; // 賣出總股數需小於等於購入股數，但不在型別層驗證
}

export const emptySellEvent = (id: string): SellEvent => ({
  id,
  sellDate: "",
  sellShares: 0,
  sellPrice: 0,
});

export const emptyTransaction = (id: string): Transaction => ({
  id,
  buyDate: "",
  buyShares: 0,
  buyPrice: 0,
  sells: [],
});

// 單一除息日的配息明細（同一 ex_date 若被多筆交易紀錄命中會加總）
export interface DistributionBreakdownRow {
  exDate: string;
  payableDate: string;
  shares: number;
  perShare: number;
  grossAmount: number;
  netAmount: number;
}

export interface ProfitResult {
  totalDiv: number;
  totalPriceGain: number;
  totalRefund: number;
  totalCost: number;
  total: number;
  totalWithRefund: number;
  breakdown: DistributionBreakdownRow[];
  finalShares: number;
  priceOnlyRate: number | null;
}
