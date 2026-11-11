import type {
  CommonResponse,
  ListByPaginationRequest,
  Pagination,
} from "@/apis/interfaces.ts";
import type { Actress } from "@/types/av.ts";
import type { ActressRef } from "@/helpers/avActressRef.ts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

// ActressRef：指定是哪一位（女優頁網址的參數），指定了卻對不到時回空結果
export interface ActressSearchRequest extends ActressRef {
  page: number;
  b?: number[];
  w?: number[];
  h?: number[];
  cup?: string;
  // 複選罩杯，逗號分隔（A,B,D），符合任一個即可
  cups?: string;
  height?: number[];
  random?: number;
  birth_year?: number;
  // 不帶年份時：當月壽星（依生日日期排）；再帶 birth_day 時只取那天以後（joyu 首頁「近期生日」）
  birth_month?: number;
  birth_day?: number;
  name?: string;
}

export type ActressSearchResponse = CommonResponse<Pagination<Actress[]>>;

// 女優搜尋共用的請求；signal 讓 React Query 在換條件、元件卸載時取消還沒回來的請求
const fetchActressSearch = async (
  params: ListByPaginationRequest<ActressSearchRequest>,
  signal?: AbortSignal,
) =>
  (
    await axios.get<ActressSearchResponse>(
      `${import.meta.env.VITE_API_BASE}/opendata/av/search/actress`,
      { params, signal, timeout: 10000 },
    )
  ).data;

export function useAVActressSearch(
  params: ListByPaginationRequest<ActressSearchRequest>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [params, "av/actress"],
    queryFn: ({ signal }) => fetchActressSearch(params, signal),
    enabled: enabled,
  });
}

/**
 * joyu 搜尋框的 autocomplete：跟女優搜尋頁用同一支 API、同一組快取 key（第一頁＋名字），
 * 選好按 Enter 進搜尋頁時直接用快取。換字時先留著上一批結果，下拉不會一閃一閃
 */
export function useActressSuggest(name: string, enabled: boolean) {
  const params = { page: 1, name };
  return useQuery({
    queryKey: [params, "av/actress"],
    queryFn: ({ signal }) => fetchActressSearch(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}
