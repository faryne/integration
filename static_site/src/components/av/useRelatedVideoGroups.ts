import type { Video } from "@/types/av.ts";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";

const RELATED_LIMIT = 12;

export interface RelatedVideoGroup {
  key: string;
  label: string;
  videos: Video[];
}

/**
 * 詳細頁的相關作品：同系列、同女優（各取第一個）。
 * 只回傳有結果的分組；查詢中、失敗或沒有結果的分組不出現，tab 也就不顯示
 */
export function useRelatedVideoGroups(video: Video): RelatedVideoGroup[] {
  const series = video.series.find((s) => s !== "");
  const actress = video.actresses.find((a) => a !== "");
  const bySeries = useAVVideoSearch({ page: 1, series }, !!series);
  const byActress = useAVVideoSearch({ page: 1, actress }, !!actress);

  // 排除目前這部；新舊資料的 no 大小寫不一，比對時一律轉小寫
  const pick = (rows?: Video[]) =>
    (rows ?? [])
      .filter((v) => v.no.toLowerCase() !== video.no.toLowerCase())
      .slice(0, RELATED_LIMIT);

  return [
    {
      key: "series",
      label: "同系列作品",
      videos: pick(bySeries.data?.data?.data),
    },
    {
      key: "actress",
      label: `${actress} 的其他作品`,
      videos: pick(byActress.data?.data?.data),
    },
  ].filter((group) => group.videos.length > 0);
}
