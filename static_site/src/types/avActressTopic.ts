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
  /** 有類型條件的主題才有（全部類型條件）；女優頁從這個主題點進來時每個類型各一個「該類型作品」tab */
  genre_tags?: string[];
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

// ===== 管理員自訂主題（/admin/av/actress-topics），格式對應後端 actress_topic_admin.go =====

export type ActressTopicGroupKey = "special" | "body";

export interface ActressTopicGenreCondition {
  tag: string;
  min: number;
}

/** 條件：同一欄位多個值是 OR、不同欄位是 AND；區間 [min, max]，0（罩杯是空字串）代表不限 */
export interface ActressTopicConditions {
  horoscope?: string[];
  blood?: string[];
  birth_year?: [number, number];
  height?: [number, number];
  cup?: [string, string];
  bust?: [number, number];
  waist?: [number, number];
  hips?: [number, number];
  hip_waist_diff?: [number, number];
  born_city?: string[];
  genres?: ActressTopicGenreCondition[];
  debut_within_months?: number;
  active_within_months?: number;
  min_videos?: number;
}

export interface ActressTopicSaveRequest {
  slug: string;
  title: string;
  group_key: ActressTopicGroupKey;
  default_sort: Exclude<ActressTopicSort, "name">;
  conditions: ActressTopicConditions;
}

export interface ActressTopicAdminItem extends ActressTopicSaveRequest {
  id: number;
  sort_order: number;
  summary: string;
  is_enabled: boolean;
  /** null＝儲存後還沒跑過每週排程 */
  last_count: number | null;
  last_generated_at: string | null;
  updated_at: string;
}

export interface ActressTopicOption {
  value: string;
  count: number;
}

export interface ActressTopicOptions {
  born_cities: ActressTopicOption[];
  tags: ActressTopicOption[];
}
