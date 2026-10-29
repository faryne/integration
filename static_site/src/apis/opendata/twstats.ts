import type { CommonResponse } from "@/apis/interfaces.ts";
import type {
  TwStatRawData,
  TwStatsAreaProfile,
  TwStatsMovers,
} from "@/types/twstats.ts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

const baseUri = "https://raw.githubusercontent.com/faryne/tw-stats/master/docs";

export type TwStatsByYear = { [key: string]: TwStatRawData };
export type TwStatsByIndex = { [key: string]: string };

export function useGetTwStatsIndex() {
  return useQuery({
    queryKey: ["opendata/twstats/index"],
    queryFn: async () => {
      const response = await axios.get<TwStatsByIndex>(`${baseUri}/index.json`);
      return response.data;
    },
  });
}

// enabled 給「每萬人」換算用：只有開啟換算時才抓人口指標
export function useGetTwStatsByName(name: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [`opendata/twstats/${name}/index`],
    queryFn: async () => {
      const response = await axios.get<TwStatsByYear>(
        `${baseUri}/${name}/index.json`,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );
      return response.data;
    },
  });
}

// 縣市健檢：該縣市在全部指標的數值、22 縣市名次與年增率（後端記憶體資料方塊即時計算）
export function useTwStatsAreaProfile(area: string) {
  return useQuery({
    enabled: area !== "",
    queryKey: ["opendata/tw-stats/areas", area],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwStatsAreaProfile>>(
        `${import.meta.env.VITE_API_BASE}/opendata/tw-stats/areas/${encodeURIComponent(area)}`,
      );
      return response.data.data;
    },
  });
}

export type TwStatsMoversParams = {
  year?: number;
  area?: string;
  category?: string;
};

// 年度變化榜；切換篩選時保留上一份結果，避免整頁閃成載入中
export function useTwStatsMovers(params: TwStatsMoversParams) {
  return useQuery({
    queryKey: ["opendata/tw-stats/movers", params],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwStatsMovers>>(
        `${import.meta.env.VITE_API_BASE}/opendata/tw-stats/movers`,
        { params: { ...params, limit: 100 } },
      );
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}
