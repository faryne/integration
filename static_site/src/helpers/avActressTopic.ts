import type {
  ActressTopicFile,
  ActressTopicGroup,
  ActressTopicIndex,
  ActressTopicMember,
  ActressTopicSort,
  ActressTopicSummary,
} from "@/types/avActressTopic.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";

export const actressTopicPath = (slug: string) =>
  `/av/actress/topics/${encodeURIComponent(slug)}`;

/** 主題頁卡片連到女優頁：帶這位自己的參數（同名才分得開），再加上 ?topic=，女優頁會多一行這個主題的 chip */
export const actressTopicMemberPath = (m: ActressTopicMember, slug: string) => {
  const path = actressPagePath(m.name, m);
  return `${path}${path.includes("?") ? "&" : "?"}topic=${encodeURIComponent(slug)}`;
};

/** 用 slug 在 index.json 裡找主題；找不到（亂填、已下架）回 undefined */
export function findActressTopic(
  index: ActressTopicIndex | undefined,
  slug: string,
): { group: ActressTopicGroup; topic: ActressTopicSummary } | undefined {
  for (const group of index?.groups ?? []) {
    const topic = group.topics.find((t) => t.slug === slug);
    if (topic) return { group, topic };
  }
}

/** 這個主題可以用的排序：預設的排第一，類型部數、出道日只在有意義的主題出現 */
export function actressTopicSorts(file: ActressTopicFile): ActressTopicSort[] {
  const sorts: ActressTopicSort[] = ["videos", "recent", "name"];
  if (file.genre_tag) sorts.unshift("genre");
  if (file.default_sort === "debut") sorts.unshift("debut");
  return [file.default_sort, ...sorts.filter((s) => s !== file.default_sort)];
}

export const actressTopicSortLabel = (
  sort: ActressTopicSort,
  file: ActressTopicFile,
) =>
  ({
    genre: `${file.genre_tag ?? "類型"}出演數`,
    videos: "出演數",
    recent: "最近出演",
    debut: "出道日",
    name: "名字",
  })[sort];

/** 依排序方式重排（不改原陣列）；日期是 yyyy/MM/dd 字串，可以直接比；沒有資料的排最後 */
export function sortActressTopicMembers(
  members: ActressTopicMember[],
  sort: ActressTopicSort,
) {
  const desc = (a = "", b = "") => b.localeCompare(a);
  const compare: Record<
    ActressTopicSort,
    (a: ActressTopicMember, b: ActressTopicMember) => number
  > = {
    videos: (a, b) => b.video_count - a.video_count,
    genre: (a, b) => (b.genre_count ?? 0) - (a.genre_count ?? 0),
    recent: (a, b) => desc(a.last_vod_date, b.last_vod_date),
    debut: (a, b) => desc(a.first_vod_date, b.first_vod_date),
    name: (a, b) => a.name.localeCompare(b.name, "ja"),
  };
  return [...members].sort(compare[sort]);
}

/** 2026/10/20 → 2026/10（卡片上只顯示到月） */
export const topicMonth = (date?: string) => date?.slice(0, 7) ?? "";
