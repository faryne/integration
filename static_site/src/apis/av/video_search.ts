import type {
  CommonResponse,
  ListByPaginationRequest, Pagination,
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
  no?: string;
  maker_no?: string;
}
export type VideoSearchResponse = CommonResponse<Pagination<Video[]>>;

export function useAVVideoSearch(
  params: ListByPaginationRequest<VideoSearchRequest>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [params, "av/video"],
    queryFn: async () => {
      const response = await axios.get<VideoSearchResponse>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/search/video`,
        {
          params,
          timeout: 10000,
        },
      );
      return response.data;
    },
    enabled: enabled,
  });
}
