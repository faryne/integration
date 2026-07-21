import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type { TwseEtfShare } from "@/types/etf.ts";
import type { Transaction } from "@/components/etf/etf_profit_calculator_types.ts";

const apiBase = import.meta.env.VITE_API_BASE;
const favoritesQueryKey = ["twse-etf", "favorites"];
const favoritesBatchQueryKey = ["twse-etf", "favorites-batch"];
const favoritesRealtimePriceQueryKey = ["twse-etf", "favorites-realtime-price"];
// 跟後端即時價格 Redis 快取的 TTL 一致，快取沒換新前端也沒必要問更頻繁
const realtimePricePollIntervalMs = 10_000;

function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}

export interface TwseEtfFavorite {
  id: number;
  code: string;
  updated_at: string;
}

// 一次撈使用者全部收藏的代號，前端自己用 Set 判斷某代號是否已收藏，
// 避免列表每一列各打一次 API。
export function useTwseEtfFavorites() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...favoritesQueryKey, session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfFavorite[]>>(
        `${apiBase}/opendata/financial/twse/favorites`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export interface TwseEtfFavoriteBatchItem {
  code: string;
  distributions: TwseEtfShare[];
  transactions: Transaction[];
}

// 「我的最愛」總覽頁用：後端一次回傳全部收藏 ETF 的配息紀錄＋已儲存交易紀錄，
// 取代原本「N 支收藏各打配息紀錄 + 交易紀錄兩支 API」（收藏一多就是 2N 個並行請求）。
export function useTwseEtfFavoritesBatch() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...favoritesBatchQueryKey, session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<TwseEtfFavoriteBatchItem[]>
      >(`${apiBase}/opendata/financial/twse/favorites/batch`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      // 後端已經會補 distributions/sells，這裡是第二層防呆：Go 的 nil slice
      // marshal 成 JSON 會是 null 不是 []，沒擋住呼叫 .map() 會直接整頁白屏
      // （跟單支交易紀錄的 sells 是同一種問題）。
      return (response.data.data ?? []).map((item) => ({
        ...item,
        distributions: item.distributions ?? [],
        transactions: (item.transactions ?? []).map((t) => ({
          ...t,
          sells: t.sells ?? [],
        })),
      }));
    },
  });
}

export interface TwseEtfFavoriteRealtimePriceItem {
  code: string;
  latest_close: number;
  live_price: number | null;
}

// 我的最愛總覽頁用：輪詢收藏 ETF 的即時成交價，不用管現在開不開盤，後端沒有即時價
// 時 live_price 就是 null，畫面上 fallback 顯示 latest_close。全部代碼都拿不到即時價
// （代表現在非交易時間）就不再繼續輪詢，避免收盤後還一直空打；要恢復輪詢得重新整頁。
export function useTwseEtfFavoritesRealtimePrice(enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...favoritesRealtimePriceQueryKey, session?.user.id],
    enabled: enabled && Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<TwseEtfFavoriteRealtimePriceItem[]>
      >(`${apiBase}/opendata/financial/twse/favorites/realtime_price`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return realtimePricePollIntervalMs;
      }
      const hasAnyLivePrice = data.some((item) => item.live_price !== null);
      return hasAnyLivePrice ? realtimePricePollIntervalMs : false;
    },
    // 分頁切到背景時暫停輪詢，切回來會自動恢復
    refetchIntervalInBackground: false,
  });
}

export function useSaveTwseEtfFavorite() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      favorited,
    }: {
      code: string;
      favorited: boolean;
    }) => {
      const url = `${apiBase}/opendata/financial/twse/${code}/favorite`;
      if (favorited) {
        await axios.post(url, null, {
          headers: sessionHeaders(session!.encrypt_key),
        });
      } else {
        await axios.delete(url, {
          headers: sessionHeaders(session!.encrypt_key),
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
      void queryClient.invalidateQueries({ queryKey: favoritesBatchQueryKey });
    },
  });
}
