import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";

export interface VideoFacetBucket {
  value: string;
  count: number;
}

export interface VideoFacets {
  tags: VideoFacetBucket[];
  makers: VideoFacetBucket[];
  series: VideoFacetBucket[];
  actresses: VideoFacetBucket[];
}

/** 搜尋頁「篩選」：目前條件下的常見標籤／發售商／系列／出演與筆數（跟分頁無關，不帶 page） */
export function useAVVideoFacets(params: Partial<VideoSearchRequest>) {
  return useQuery({
    queryKey: [params, "av/video/facets"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<VideoFacets>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/search/video/facets`,
        { params, paramsSerializer: { indexes: null }, timeout: 10000 },
      );
      return response.data.data;
    },
  });
}
