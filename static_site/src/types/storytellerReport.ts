// 讀者檢舉。author 用筆名指定，後端再解析成帳號本人或額外筆名。
export type ReportTargetType =
  | "project"
  | "story"
  | "lore"
  | "author"
  | "author_post"
  | "discussion_thread"
  | "comment";

export interface ReportTarget {
  type: ReportTargetType;
  // 作品／故事／設定／動態／討論串／留言是 public_id，創作者是筆名
  publicId: string;
  // 故事與設定要另帶所屬作品
  projectPublicId?: string;
  // 不公開作品裡的東西要帶分享 token
  share?: string;
  // 對象的名稱（筆名、作品名、話名、討論串標題…）；dialog 依種類套翻譯樣板組成「路人甲 的留言」。
  // 留言者身份已不存在時不帶，顯示「已不存在的使用者」
  name?: string;
  // 留言是回覆時用「的回覆」樣板
  reply?: boolean;
}

// 檢舉理由只有 slug；文字由 moderationReasonLabel 對照
export interface ModerationReason {
  key: string;
  note_required?: boolean;
}

export interface ReportInput {
  target_type: ReportTargetType;
  target_public_id: string;
  project_public_id?: string;
  share?: string;
  reason_key: string;
  note: string;
}
