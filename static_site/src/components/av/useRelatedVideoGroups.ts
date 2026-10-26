import type { Video } from "@/types/av.ts";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";

const RELATED_LIMIT = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

// 追溯不到系列／女優的影片，改成隨機推薦「最近這段時間」配信的作品。
// 範圍是時間長度（毫秒），要調整直接換算式即可，例如 7 * DAY_MS、90 * DAY_MS
export const RELATED_RANDOM_WINDOW_MS = 30 * DAY_MS;

export interface RelatedVideoGroup {
  key: string;
  label: string;
  videos: Video[];
}

/** 近期推薦的起始日（本地時區 YYYY-MM-DD）；同一天內值固定，查詢快取才不會每次 render 都換 key */
function recentStartDate() {
  const d = new Date(Date.now() - RELATED_RANDOM_WINDOW_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 詳細頁的相關作品：同系列、同女優（各取第一個）。只回傳有結果的分組。
 * 沒有系列也沒有女優，或兩組都查完卻沒有結果時，改回傳一組「近期隨機推薦」
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

  // 分組是否存在一律看參數有沒有值：參數是 undefined 時查詢 key 會跟列表頁「全部影片」相同，
  // 就算沒送出請求也會拿到那份快取（曾經出現「undefined 的其他作品」）
  const groups: RelatedVideoGroup[] = [];
  if (series) {
    groups.push({
      key: "series",
      label: "同系列作品",
      videos: pick(bySeries.data?.data?.data),
    });
  }
  if (actress) {
    groups.push({
      key: "actress",
      label: `${actress} 的其他作品`,
      videos: pick(byActress.data?.data?.data),
    });
  }
  const traced = groups.filter((g) => g.videos.length > 0);

  const settled =
    (!series || bySeries.isFetched) && (!actress || byActress.isFetched);
  const untraceable = settled && traced.length === 0;
  const recent = useAVVideoSearch(
    { page: 1, shuffle: true, start_date: recentStartDate() },
    untraceable,
  );
  if (!untraceable) return traced;

  const videos = pick(recent.data?.data?.data);
  return videos.length > 0
    ? [{ key: "recent", label: "近期隨機推薦", videos }]
    : [];
}
