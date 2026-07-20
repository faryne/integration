import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type { Transaction } from "@/components/etf/etf_profit_calculator_types.ts";

const apiBase = import.meta.env.VITE_API_BASE;

function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}

function savedTransactionsQueryKey(code?: string, userId?: number) {
  return ["twse-etf", "saved-transactions", code, userId];
}

async function fetchSavedTransactions(code: string, encryptKey: string) {
  const response = await axios.get<CommonResponse<Transaction[]>>(
    `${apiBase}/opendata/financial/twse/${code}/transactions`,
    { headers: sessionHeaders(encryptKey) },
  );
  // 後端已經會補 sells，這裡是第二層防呆：舊格式資料 sells 是 null 不是
  // []，沒擋住的話計算引擎跟編輯畫面呼叫 .filter/.map 會直接整頁白屏。
  return (response.data.data ?? []).map((t) => ({
    ...t,
    sells: t.sells ?? [],
  }));
}

// 只在「獲利試算」分頁打開且已登入時由呼叫端用 enabled 控制是否要抓
export function useTwseEtfSavedTransactions(code?: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: savedTransactionsQueryKey(code, session?.user.id),
    enabled: Boolean(enabled && session?.encrypt_key && code),
    queryFn: () => fetchSavedTransactions(code!, session!.encrypt_key),
  });
}

// 整包覆蓋式儲存：每次都是把畫面上當下的完整交易紀錄陣列送出去蓋掉舊資料
export function useSaveTwseEtfTransactions(code?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (records: Transaction[]) => {
      await axios.put(
        `${apiBase}/opendata/financial/twse/${code}/transactions`,
        { records },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: savedTransactionsQueryKey(code, session?.user.id),
      });
    },
  });
}
