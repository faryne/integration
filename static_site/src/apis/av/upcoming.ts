import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type {
  CommonResponse,
  ListByPaginationRequest,
  Pagination,
} from "@/apis/interfaces.ts";
import { joyuApi } from "@/apis/av/joyu_me.ts";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import type { Video } from "@/types/av.ts";

// joyu.fyi 即將發售：DMM 預約作品（每日排程更新）。條件跟影片搜尋一樣；沒帶日期時後端用明天起 30 天，
// end_date 不含當天；sort 預設 soonest

const api = import.meta.env.VITE_API_BASE;

export interface UpcomingDateCount {
  date: string; // yyyy-MM-dd
  count: number;
}

export function useUpcoming(
  params: Partial<ListByPaginationRequest<VideoSearchRequest>>,
  enabled = true,
) {
  return useQuery({
    queryKey: [params, "av/upcoming"],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<Pagination<Video[]>>>(
          `${api}/opendata/av/upcoming`,
          { params, paramsSerializer: { indexes: null }, timeout: 10000 },
        )
      ).data.data,
    enabled,
  });
}

export function useUpcomingDates(params: Partial<VideoSearchRequest>) {
  return useQuery({
    queryKey: [params, "av/upcoming/dates"],
    queryFn: async () =>
      (
        await axios.get<CommonResponse<UpcomingDateCount[]>>(
          `${api}/opendata/av/upcoming/dates`,
          { params, paramsSerializer: { indexes: null }, timeout: 10000 },
        )
      ).data.data,
  });
}

/** 即將發售頁「我追蹤的」：符合任一筆追蹤的預約作品 */
export function useMyUpcoming(uid: string | undefined, page: number) {
  return useQuery({
    queryKey: ["joyu/upcoming", uid, page],
    queryFn: () =>
      joyuApi<Pagination<Video[]>>("GET", "/upcoming", { params: { page } }),
    enabled: !!uid,
  });
}
