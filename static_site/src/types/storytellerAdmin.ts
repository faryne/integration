// 管理後台（檢舉處理）。對象一律以 public_id 指定，文字標籤由前端依種類組合。

// 檢舉紀錄裡存的對象種類（創作者分成帳號本人 user 與額外筆名 author_profile）
export type AdminTargetType =
  | "project"
  | "story"
  | "lore"
  | "user"
  | "author_profile"
  | "author_post"
  | "discussion_thread"
  | "comment";

export type AdminReportStatus = "pending" | "resolved" | "dismissed";

// 列表篩選用：author 會由後端展開成 user／author_profile
export type AdminTargetFilter =
  Exclude<AdminTargetType, "user" | "author_profile"> | "author";

export interface AdminTargetLink {
  project_public_id?: string;
  project_slug?: string;
  story_public_id?: string;
  lore_public_id?: string;
  thread_public_id?: string;
  post_public_id?: string;
  comment_public_id?: string;
  pen_name?: string;
}

export interface AdminFootprint {
  projects: number;
  posts: number;
  threads: number;
  comments: number;
}

export interface AdminReportTarget {
  type: AdminTargetType;
  // 對外只用 public_id（後台網址、API 都不帶內部流水號）
  public_id: string;
  title?: string;
  owner_name?: string;
  excerpt?: string;
  body?: string;
  context_project?: string;
  context_thread?: string;
  deleted?: boolean;
  // 有值＝站方處置；deleted 但沒有理由＝作者自行刪除
  delete_reason?: string;
  link: AdminTargetLink;
  created_at?: string;
  footprint?: AdminFootprint;
  account_pen_name?: string;
  extra_pen_names?: string[];
  is_volume?: boolean;
}

export interface AdminReasonCount {
  key: string;
  count: number;
}

export interface AdminReportGroup {
  target: AdminReportTarget;
  count: number;
  reasons: AdminReasonCount[];
  last_reported_at: string;
  last_handled_at?: string;
}

export interface AdminReportList {
  items: AdminReportGroup[];
  total: number;
  page: number;
  counts: Partial<Record<AdminReportStatus, number>>;
}

export interface AdminReportEntry {
  public_id: string;
  reason_key: string;
  note?: string;
  reporter_name?: string;
  status: AdminReportStatus;
  handled_by?: string;
  handled_at?: string;
  created_at: string;
}

export interface AdminReportActions {
  can_remove: boolean;
  can_dismiss: boolean;
  // 對象已被作者自行刪除，只能結案
  can_close: boolean;
  remove_reasons?: string[];
  default_reason?: string;
}

export interface AdminReportDetail {
  target: AdminReportTarget;
  pending: number;
  reasons: AdminReasonCount[];
  reports: AdminReportEntry[];
  actions: AdminReportActions;
}

export interface AdminMe {
  permissions: string[];
}
