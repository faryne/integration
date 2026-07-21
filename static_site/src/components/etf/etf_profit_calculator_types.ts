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

// 明細表的一列：可能是配息（同一 ex_date 若被多筆交易紀錄命中會加總成一列）
// 或一次賣出（每筆賣出各自一列，不合併）。realized 是「除息日是否已過 / 一律
// 為已處分」，用來在表上標示已實現／未實現。
export interface ProfitDetailRow {
  id: string;
  date: string;
  type: "dividend" | "sell";
  description: string;
  grossAmount: number; // 配息：總配息金額；賣出：已實現損益（可能為負）
  netAmount: number | null; // 配息稅後實領（僅美股才有意義），賣出固定為 null
  refundAmount: number | null; // 配息的預估退稅（僅美股 ROC > 0 時才有值），賣出固定為 null
  realized: boolean;
}

export interface ProfitResult {
  totalCost: number;
  finalShares: number;
  detail: ProfitDetailRow[];

  // 已實現：除息日已過的配息 + 已賣出部分的損益
  realizedDividend: number;
  realizedPriceGain: number;
  realizedRefund: number; // 美股專屬的預估退稅，台股固定為 0
  realizedTotal: number;

  // 未實現：除息日未到的配息（若已公告金額） + 未賣出部位的帳面損益
  unrealizedDividend: number;
  unrealizedPriceGain: number;
  unrealizedRefund: number;
  unrealizedTotal: number;

  grandTotal: number; // = realizedTotal + unrealizedTotal

  realizedRate: number | null;
  unrealizedRate: number | null;
  grandTotalRate: number | null;
}
