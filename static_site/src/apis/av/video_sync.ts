import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";

export interface VideoSyncResult {
  no: string;
  maker_no: string;
}

/** 詳細頁「同步資料」：用 DMM 內部番號重抓單一作品，補齊舊資料缺的官方番號 */
export function useSyncAVVideo() {
  return useMutation({
    mutationFn: async (no: string) => {
      const response = await axios.post<CommonResponse<VideoSyncResult>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/video/${encodeURIComponent(no)}/sync`,
        undefined,
        { timeout: 30000 },
      );
      return response.data.data;
    },
  });
}
