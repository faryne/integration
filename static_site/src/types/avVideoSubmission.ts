import type { ActressLink } from "@/types/av.ts";
import type { SubmissionStatus } from "@/types/avSubmission.ts";

/** 影片開放修改的欄位（與後端 VideoFields 同格式） */
export interface VideoFields {
  title: string;
  // 官方番號；填了詳細頁就有 MissAV 連結，網址也會換成官方番號
  maker_no: string;
  // 配信日／發售日（YYYY/MM/DD）
  vod_date: string;
  publish_date: string;
  duration: number;
  actresses: string[];
  directors: string[];
  series: string[];
  makers: string[];
  labels: string[];
  tags: string[];
  links: ActressLink[];
}

export type VideoFieldKey = keyof VideoFields;

/** 可以 autocomplete 的陣列欄位 */
export type VideoTermKey =
  "actresses" | "directors" | "series" | "makers" | "labels" | "tags";

export interface VideoSubmitRequest {
  // 詳細頁的內部番號（ES 的 no）
  target_no: string;
  fields: VideoFields;
}

export interface VideoSubmitResult {
  id: number;
  status: SubmissionStatus;
  changed_fields: VideoFieldKey[];
  new_values: Partial<Record<VideoTermKey, string[]>>;
}

export interface VideoSubmissionSummary {
  id: number;
  target_vid: number;
  target_no: string;
  channel: "web" | "mcp";
  submitter_user_id: number | null;
  status: SubmissionStatus;
  reviewer_user_id: number | null;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  title: string;
  maker_no: string;
  changed_fields: VideoFieldKey[];
  ip_hash_prefix: string;
  // 提交後影片資料被改過／影片在搜尋裡已經找不到
  conflict: boolean;
  missing: boolean;
}

export interface VideoRef {
  no: string;
  maker_no: string;
  title: string;
}

export interface VideoSubmissionDetail extends VideoSubmissionSummary {
  payload: VideoFields;
  base: VideoFields;
  current: VideoFields | null;
  thumb: string;
  // 影片庫裡還沒有的值、官方番號已被別部使用、有同名問題的新出演
  new_values: Partial<Record<VideoTermKey, string[]>>;
  maker_no_taken: VideoRef[];
  same_name_actresses: string[];
}

/** autocomplete 的一個選項 */
export interface VideoTermOption {
  value: string;
  count: number;
}
