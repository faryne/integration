import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";

// joyu.fyi 女優股市（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）。
// P1 只有公開讀取；價格單位是「單位」，小數兩位

const api = import.meta.env.VITE_API_BASE;

export interface MarketStock {
  code: string; // J0001
  domain: string;
  aid: number;
  name: string;
  photo: string;
  status: "listed" | "delisted";
  price: number;
  prev_close: number;
  shares_out: number;
  videos_90d: number;
  listed_at: string;
}

/** 漲跌幅（%），昨收是 0 時當作沒變 */
export const stockChangePct = (s: MarketStock) =>
  s.prev_close ? ((s.price - s.prev_close) / s.prev_close) * 100 : 0;

/** 股市總覽：上市中的全部（約 500 檔），排序與篩選在前端做 */
export function useMarketStocks() {
  return useQuery({
    queryKey: ["joyu/market/stocks"],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<MarketStock[]>>(
          `${api}/opendata/av/market/stocks`,
          { timeout: 10000 },
        )
      ).data.data,
  });
}

/** 個股頁 */
export function useMarketStock(code: string | undefined) {
  return useQuery({
    queryKey: ["joyu/market/stock", code],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<MarketStock>>(
          `${api}/opendata/av/market/stocks/${encodeURIComponent(code!)}`,
          { timeout: 10000 },
        )
      ).data.data,
    enabled: !!code,
    // 代碼打錯是 404，重試也不會好
    retry: (count, err) =>
      !(axios.isAxiosError(err) && err.response?.status === 404) && count < 2,
  });
}
