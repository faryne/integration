import type { Video } from "@/types/av.ts";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
// 多人合輯的女優可能有十幾位，tab 太多會塞不下，只取前幾位
const MAX_ACTRESS_TABS = 5;

// 追溯不到系列／女優／監督／品牌的影片，改成隨機推薦「最近這段時間」配信的作品。
// 範圍是時間長度（毫秒），要調整直接換算式即可，例如 7 * DAY_MS、90 * DAY_MS
export const RELATED_RANDOM_WINDOW_MS = 30 * DAY_MS;

export interface RelatedTab {
  key: string;
  label: string;
  // 該 tab 的搜尋條件（精確篩選）；切換到該 tab 才會送出查詢
  filter: Partial<VideoSearchRequest>;
}

const firstNonEmpty = (values: string[]) => values.find((v) => v.trim() !== "");

/** 近期推薦的起始日（本地時區 YYYY-MM-DD）；同一天內值固定，查詢快取才不會每次 render 都換 key */
function recentStartDate() {
  const d = new Date(Date.now() - RELATED_RANDOM_WINDOW_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 詳細頁的相關作品 tab：依「這部片有沒有該欄位」決定，不先查詢（延遲載入，切到 tab 才查）。
 * 同系列 → 每位女優（最多 5 位）→ 同監督 → 同品牌；都沒有就給一個近期隨機推薦
 */
export function relatedVideoTabs(video: Video): RelatedTab[] {
  const tabs: RelatedTab[] = [];
  const series = firstNonEmpty(video.series);
  if (series)
    tabs.push({ key: "series", label: "同系列作品", filter: { series } });

  const actresses = [
    ...new Set(video.actresses.filter((a) => a.trim() !== "")),
  ];
  for (const actress of actresses.slice(0, MAX_ACTRESS_TABS)) {
    tabs.push({
      key: `actress:${actress}`,
      label: `${actress} 的其他作品`,
      filter: { actress },
    });
  }

  const director = firstNonEmpty(video.directors);
  if (director)
    tabs.push({ key: "director", label: "同監督作品", filter: { director } });
  const label = firstNonEmpty(video.labels);
  if (label)
    tabs.push({ key: "label", label: "同品牌作品", filter: { label } });

  if (tabs.length === 0) {
    tabs.push({
      key: "recent",
      label: "近期隨機推薦",
      filter: { shuffle: true, start_date: recentStartDate() },
    });
  }
  return tabs;
}
