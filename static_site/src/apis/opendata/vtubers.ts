import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import type {
  VtuberChannelDetail,
  VtuberChannelList,
  VtuberLiveList,
  VtuberStat,
  VtuberVideoPage,
} from "@/types/vtubers.ts";

const base = `${import.meta.env.VITE_API_BASE}/opendata/vtubers`;
// 後端每 5 分鐘偵測一次，前端每分鐘重抓就夠新
const LIVE_REFETCH_MS = 60_000;

export function useVtuberChannels() {
  return useQuery({
    queryKey: ["vtubers", "channels"],
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () =>
      (await axios.get<CommonResponse<VtuberChannelList>>(`${base}/channels`))
        .data.data,
  });
}

export function useVtuberChannel(handle: string) {
  return useQuery({
    queryKey: ["vtubers", "channel", handle],
    enabled: Boolean(handle),
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberChannelDetail>>(
          `${base}/channels/${encodeURIComponent(handle)}`,
        )
      ).data.data,
  });
}

export function useVtuberChannelStats(handle: string) {
  return useQuery({
    queryKey: ["vtubers", "stats", handle],
    enabled: Boolean(handle),
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberStat[]>>(
          `${base}/channels/${encodeURIComponent(handle)}/stats`,
          { params: { days: 90 } },
        )
      ).data.data,
  });
}

// 「所有影片」：page_token 分頁，捲到底載入下一頁
export function useVtuberChannelVideos(handle: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["vtubers", "videos", handle],
    enabled: Boolean(handle) && enabled,
    initialPageParam: "",
    queryFn: async ({ pageParam }) =>
      (
        await axios.get<CommonResponse<VtuberVideoPage>>(
          `${base}/channels/${encodeURIComponent(handle)}/videos`,
          { params: pageParam ? { page_token: pageParam } : {} },
        )
      ).data.data,
    getNextPageParam: (last) => last.next_page_token || undefined,
  });
}

// 沒給 channelId 時查全部頻道；區間用後端預設（一天前到兩週後）。
// 藝人頁要等頻道資料回來才知道 channelId，先用 enabled 擋住，避免多抓一次全部頻道
export function useVtuberLives(channelId?: string, enabled = true) {
  return useQuery({
    queryKey: ["vtubers", "lives", channelId ?? ""],
    enabled,
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberLiveList>>(`${base}/lives`, {
          params: channelId ? { channel_id: channelId } : {},
        })
      ).data.data,
  });
}
