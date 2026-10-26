import type {
  CommonResponse,
  ListByPaginationRequest,
  Pagination,
} from "@/apis/interfaces";
import type { Video } from "@/types/av";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface VideoSearchRequest {
  page: number;
  year?: number;
  month?: number;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  actress?: string;
  // 詳細頁 chip 的精確篩選
  tag?: string;
  maker?: string;
  label?: string;
  series?: string;
  director?: string;
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
