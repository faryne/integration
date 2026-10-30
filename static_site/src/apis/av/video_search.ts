import type {
  CommonResponse,
  ListByPaginationRequest,
  Pagination,
} from "@/apis/interfaces";
import type { Video } from "@/types/av";
import type { ActressRef } from "@/helpers/avActressRef.ts";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// ActressRef：女優頁指定是哪一位，同名女優的新影片依 DMM 女優 ID 分開；對不到時退回 actress（名字）
export interface VideoSearchRequest extends ActressRef {
  page: number;
  year?: number;
  month?: number;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  actress?: string;
  // 詳細頁 chip 的精確篩選；標籤可複選（交集）
  tag?: string[];
  maker?: string;
  label?: string;
  series?: string;
  director?: string;
  // 隨機排序（詳細頁追溯不到系列／女優時的近期推薦）；ListByPaginationRequest 已有別的 random 欄位，避開同名
  shuffle?: boolean;
  no?: string;
  maker_no?: string;
}
export type VideoSearchResponse = CommonResponse<Pagination<Video[]>>;

// 查詢 key 與實際請求抽出來，讓頁面可以用 queryClient.fetchQuery 先確認資料再換頁（快取也會共用）
export const avVideoSearchQueryKey = (
  params: ListByPaginationRequest<VideoSearchRequest>,
) => [params, "av/video"];

export async function fetchAVVideoSearch(
  params: ListByPaginationRequest<VideoSearchRequest>,
) {
  const response = await axios.get<VideoSearchResponse>(
    `${import.meta.env.VITE_API_BASE}/opendata/av/search/video`,
    {
      params,
      // 陣列參數送成 tag=A&tag=B（axios 預設是 tag[]=A，後端讀不到）
      paramsSerializer: { indexes: null },
      timeout: 10000,
    },
  );
  return response.data;
}

export function useAVVideoSearch(
  params: ListByPaginationRequest<VideoSearchRequest>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: avVideoSearchQueryKey(params),
    queryFn: () => fetchAVVideoSearch(params),
    enabled: enabled,
  });
}
