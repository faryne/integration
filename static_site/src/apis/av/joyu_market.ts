import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import { joyuApi } from "@/apis/av/joyu_me.ts";

// joyu.fyi 女優股市（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）。
// 公開讀取用 axios；錢包、報價、下單、成交紀錄走 joyuApi（只限 Google 帳號）。價格單位是「單位」，小數兩位

const api = import.meta.env.VITE_API_BASE;

/** 股市的快取 key 前綴；個人資料（錢包、報價、成交紀錄）另外用 MARKET_ME_KEY，登出時清掉 */
const MARKET_KEY = "joyu/market";
export const MARKET_ME_KEY = "joyu/market/me";

export interface MarketStock {
  code: string; // J0001
  domain: string;
  aid: number;
  name: string;
  photo: string;
  status: "listed" | "delisted";
  price: number;
  fundamental: number; // 基本價 F：沒人持股時股價就是 F
  prev_close: number;
  shares_out: number;
  share_cap: number; // 發行上限：流通股數到了就暫停買進
  videos_90d: number;
  volume: number; // 今天的成交股數
  buy_volume: number; // 今天買進的股數
  sell_volume: number; // 今天賣出的股數
  listed_at: string;
}

export interface MarketRecentTrade {
  side: "buy" | "sell";
  shares: number;
  price: number;
  created_at: string;
}

export interface MarketStockDetail extends MarketStock {
  recent_trades: MarketRecentTrade[];
}

export interface MarketQuote {
  side: "buy" | "sell";
  shares: number;
  amount: number;
  fee: number;
  total: number;
  total_cents: number; // 下單時原樣帶回當 limit
  price_after: number;
  max_shares: number;
}

export interface MarketHolding {
  stock: MarketStock;
  shares: number;
  sellable: number; // 今天買的不能賣（T+1）
  cost: number;
}

export interface MarketWallet {
  cash: number;
  holdings_value: number;
  total: number;
  return_pct: number;
  rank: number; // 總資產排名
  holdings: MarketHolding[];
}

export interface MarketTradeRow {
  code: string;
  name: string;
  side: "buy" | "sell";
  shares: number;
  amount: number;
  fee: number;
  created_at: string;
}

export interface MarketPricePoint {
  date: string; // yyyy-MM-dd
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketLeader {
  rank: number;
  name: string;
  total: number;
  return_pct: number;
  top_code: string;
  top_name: string;
}

/** 漲跌幅（%），昨收是 0 時當作沒變 */
export const stockChangePct = (s: MarketStock) =>
  s.prev_close ? ((s.price - s.prev_close) / s.prev_close) * 100 : 0;

/** 股市總覽：上市中的全部（約 500 檔），排序與篩選在前端做 */
export function useMarketStocks() {
  return useQuery({
    queryKey: [MARKET_KEY, "stocks"],
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
    queryKey: [MARKET_KEY, "stock", code],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<MarketStockDetail>>(
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

/** 個股 K 線：最近 days 天的每日開高低收與成交量（今天這一根畫圖時用現價補） */
export function useMarketHistory(code: string | undefined, days: number) {
  return useQuery({
    queryKey: [MARKET_KEY, "history", code, days],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<MarketPricePoint[]>>(
          `${api}/opendata/av/market/stocks/${encodeURIComponent(code!)}/history`,
          { params: { days }, timeout: 10000 },
        )
      ).data.data,
    enabled: !!code,
    placeholderData: keepPreviousData,
  });
}

/** 排行榜：總資產前 50 名（後端 5 分鐘更新一次） */
export function useMarketLeaderboard() {
  return useQuery({
    queryKey: [MARKET_KEY, "leaderboard"],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<MarketLeader[]>>(
          `${api}/opendata/av/market/leaderboard`,
          { timeout: 10000 },
        )
      ).data.data,
  });
}

/** 女優頁的「股票」分頁：這位上市過（含已下市）就有資料，沒上市是 null（404 不重試） */
export function useMarketStockByActress(actress?: {
  domain: string;
  aid: number;
}) {
  return useQuery({
    queryKey: [MARKET_KEY, "actress-stock", actress?.domain, actress?.aid],
    queryFn: async () => {
      try {
        return (
          await axios.get<CommonResponse<MarketStockDetail>>(
            `${api}/opendata/av/market/actress-stock`,
            {
              params: { aid: actress!.aid, domain: actress!.domain },
              timeout: 10000,
            },
          )
        ).data.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404)
          return null;
        throw err;
      }
    },
    enabled: !!actress,
  });
}

/** 我的資產（第一次呼叫時後端開戶）；uid 是 Google 帳號才查 */
export function useMarketWallet(uid: string | undefined) {
  return useQuery({
    queryKey: [MARKET_ME_KEY, "wallet", uid],
    queryFn: () => joyuApi<MarketWallet>("get", "/market/wallet"),
    enabled: !!uid,
  });
}

/** 報價：股數改了就重算；換股數時先留著上一筆，面板不會一閃一閃 */
export function useMarketQuote(
  uid: string | undefined,
  code: string,
  side: "buy" | "sell",
  shares: number,
) {
  return useQuery({
    queryKey: [MARKET_ME_KEY, "quote", uid, code, side, shares],
    queryFn: () =>
      joyuApi<MarketQuote>("get", `/market/stocks/${code}/quote`, {
        params: { side, shares },
      }),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  });
}

/** 我的成交紀錄（一頁 30 筆） */
export function useMarketTrades(uid: string | undefined, page: number) {
  return useQuery({
    queryKey: [MARKET_ME_KEY, "trades", uid, page],
    queryFn: () =>
      joyuApi<{ data: MarketTradeRow[]; total: number }>(
        "get",
        "/market/trades",
        { params: { page } },
      ),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  });
}

/** 下單；成交後整個股市的快取都重抓（價格、錢包、持股、成交紀錄都變了） */
export function useMarketTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      code: string;
      side: "buy" | "sell";
      shares: number;
      limit: number;
    }) =>
      joyuApi<MarketQuote>("post", `/market/stocks/${v.code}/trades`, {
        data: { side: v.side, shares: v.shares, limit: v.limit },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: [MARKET_KEY] }),
  });
}

// 交易失敗的錯誤碼（後端 controller/joyu/market.go）→ 顯示的訊息
const tradeErrors: Record<string, string> = {
  "403501": "股市只限 Google 帳號，請先用 Google 登入",
  "409501": "價格在你下單前變了，已重新報價，請確認後再送出",
  "400501": "超過今天的漲跌停限制",
  "400502": "現金不夠",
  "400503": "可賣的股數不夠（今天買的明天才能賣）",
  "400504": "這檔已經下市，不能交易",
  "400505": "已達發行上限，要等有人賣出才能再買",
  "429007": "下單太頻繁了，請稍等一下",
};

export const marketTradeErrorMessage = (err: unknown) => {
  const code = axios.isAxiosError(err)
    ? (err.response?.data as { custom_code?: string } | undefined)?.custom_code
    : undefined;
  return (code && tradeErrors[code]) || "下單失敗，請稍後再試";
};
