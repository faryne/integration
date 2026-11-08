import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import type {
  VideoTermKey,
  VideoTermOption,
} from "@/types/avVideoSubmission.ts";

/** 出演／發售商…等陣列欄位的 autocomplete（影片修改表單、影片搜尋表單共用）；後端有快取，前端也保留 10 分鐘 */
export function useVideoTermSuggest(field: VideoTermKey, q: string) {
  return useQuery({
    queryKey: ["av-video-suggest", field, q],
    staleTime: 600_000,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<VideoTermOption[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/video/suggest`,
        { params: { field, q } },
      );
      return response.data.data;
    },
  });
}
