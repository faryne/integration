// 女優主題：每週排程產生的靜態 JSON（S3／CDN），格式對應後端 model/entity/opendata/av/actress_topic.go

/** 主題頁的排序方式；genre 只有帶類型部數的主題才有、debut 只有新人 */
export type ActressTopicSort = "videos" | "recent" | "genre" | "debut" | "name";

export interface ActressTopicSummary {
  slug: string;
  label: string;
  count: number;
  file: string;
  /** 自訂主題（身材、特輯）的條件摘要 */
  summary?: string;
}

export interface ActressTopicGroup {
  key: string;
  label: string;
  topics: ActressTopicSummary[];
}

/** index.json：總覽頁的分組與主題清單，也用來把 slug 對到檔名 */
export interface ActressTopicIndex {
  generated_at: string;
  groups: ActressTopicGroup[];
}

export interface ActressTopicMember {
  domain: string;
  aid: number;
  name: string;
  photo: string;
  video_count: number;
  first_vod_date?: string;
  last_vod_date?: string;
  genre_count?: number;
}

export interface ActressTopicFile {
  slug: string;
  label: string;
  generated_at: string;
  default_sort: ActressTopicSort;
  /** 卡片上「熟女 88 部」的類型名稱，沒有類型條件的主題不會有 */
  genre_tag?: string;
  actresses: ActressTopicMember[];
}
