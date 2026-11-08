import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import type { ActressRef } from "@/helpers/avActressRef.ts";
import type { Actress } from "@/types/av.ts";

// joyu.fyi 首頁與女優頁新增的兩支 API（後端 service/av/joyu_*.go）

/** 出演者：actress 只有對得到唯一一位女優時才有（照片、參數），否則只能用名字連到女優搜尋 */
export interface JoyuActressItem {
  name: string;
  count: number;
  actress?: Actress;
}

/** 首頁「今天有新片的女優」：date 是實際採用的配信日（今天還沒新片時是最近一天，yyyy/MM/dd） */
export interface JoyuNewActresses {
  date: string;
  actresses: JoyuActressItem[];
}

/** 女優頁：作品數、最早／最新配信日（yyyy/MM/dd）、共演女優 */
export interface JoyuActressSummary {
  count: number;
  first: string;
  last: string;
  co_stars: JoyuActressItem[];
}

export function useJoyuNewActresses() {
  return useQuery({
    queryKey: ["av/home/new-actresses"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<JoyuNewActresses>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/home/new-actresses`,
        { timeout: 10000 },
      );
      return response.data.data;
    },
  });
}

export function useJoyuActressSummary(
  params: ActressRef & { actress: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [params, "av/actress/summary"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<JoyuActressSummary>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/actress/summary`,
        { params, timeout: 10000 },
      );
      return response.data.data;
    },
    enabled,
  });
}

/** 影片頁出演女優卡：依出演者名字批次取女優資料；key 是原始名字，對不到或同名多位的不會出現 */
export function useJoyuActressesByNames(names: string[]) {
  return useQuery({
    queryKey: [names, "av/actress/by-names"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<Record<string, Actress>>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/actress/by-names`,
        {
          params: { name: names },
          paramsSerializer: { indexes: null },
          timeout: 10000,
        },
      );
      return response.data.data;
    },
    enabled: names.length > 0,
  });
}
