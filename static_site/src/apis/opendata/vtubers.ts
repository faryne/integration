import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import type {
  VtuberChannelDetail,
  VtuberChannelList,
  VtuberLiveList,
  VtuberStat,
  VtuberVideoDetail,
  VtuberVideoPage,
  VtuberVideoType,
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

// 統計分頁：days 上限 365（後端限制）；切期間時保留上一份資料，圖表不會閃一下空白
export function useVtuberChannelStats(handle: string, days: number) {
  return useQuery({
    queryKey: ["vtubers", "stats", handle, days],
    enabled: Boolean(handle),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberStat[]>>(
          `${base}/channels/${encodeURIComponent(handle)}/stats`,
          { params: { days } },
        )
      ).data.data,
  });
}

// 「所有影片」：依分類讀上傳清單，page_token 分頁，捲到底載入下一頁
export function useVtuberChannelVideos(handle: string, type: VtuberVideoType) {
  return useInfiniteQuery({
    queryKey: ["vtubers", "videos", handle, type],
    enabled: Boolean(handle),
    initialPageParam: "",
    queryFn: async ({ pageParam }) =>
      (
        await axios.get<CommonResponse<VtuberVideoPage>>(
          `${base}/channels/${encodeURIComponent(handle)}/videos`,
          { params: { type, ...(pageParam ? { page_token: pageParam } : {}) } },
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

// 影片 modal 的說明：點開時才查，後端快取 6 小時；同一部影片前端也只查一次
export function useVtuberVideoDetail(videoId: string | undefined) {
  return useQuery({
    queryKey: ["vtubers", "video", videoId],
    enabled: Boolean(videoId),
    staleTime: Infinity,
    retry: false,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberVideoDetail>>(
          `${base}/videos/${encodeURIComponent(videoId!)}`,
        )
      ).data.data,
  });
}

// 總覽「過去的直播」：from／to 是台北日期（YYYY-MM-DD），只要已結束的；存檔不太會變，不用每分鐘重抓
export function useVtuberEndedLives(from: string, to: string) {
  return useQuery({
    queryKey: ["vtubers", "lives", "ended", from, to],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<VtuberLiveList>>(`${base}/lives`, {
          params: { status: "ended", from, to },
        })
      ).data.data,
  });
}
