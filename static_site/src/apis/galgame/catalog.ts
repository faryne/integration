import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import type {
  GalgameBrand,
  GalgameVideo,
  GalgameVideoSearch,
} from "@/types/galgame.ts";

const apiBase = import.meta.env.VITE_API_BASE;

export function useGalgameBrands(keyword = "") {
  return useQuery({
    queryKey: ["galgame-brands", keyword],
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameBrand[]>>
      >(`${apiBase}/galgame/brands`, {
        params: { keyword: keyword || undefined, per_page: 100 },
      });
      return response.data.data;
    },
  });
}

export function useGalgameVideos(
  brandId: string | undefined,
  search: GalgameVideoSearch,
) {
  return useQuery({
    queryKey: ["galgame-videos", brandId, search],
    queryFn: async () => {
      const prefix = brandId ? `/galgame/${brandId}/video` : "/galgame/video";
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideo[]>>
      >(`${apiBase}${prefix}`, { params: search });
      return response.data.data;
    },
  });
}

export function useGalgameVideo(brandId?: string, videoId?: string) {
  return useQuery({
    queryKey: ["galgame-video", brandId, videoId],
    enabled: Boolean(brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameVideo>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}`,
      );
      return response.data.data;
    },
  });
}
