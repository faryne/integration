export interface Transaction {
  id: string;
  buyDate: string;
  buyShares: number; // 原始購入股數
  buyPrice: number;
  isSold: boolean;
  sellDate: string;
  sellShares: number; // 賣出股數 (需小於等於購入股數)
  sellPrice: number;
}

export const emptyTransaction = (id: string): Transaction => ({
  id,
  buyDate: "",
  buyShares: 0,
  buyPrice: 0,
  isSold: false,
  sellDate: "",
  sellShares: 0,
  sellPrice: 0,
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
