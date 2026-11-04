// neko.maid.tw 禁抓名單與版權申告的型別（後端 model/entity/nekomaid/{artwork_forbidden,forbidden_submission}.go）

/** 禁抓的來源：後台新增／版權申告核准／改版前舊資料 */
export type NekomaidForbiddenSource = "admin" | "submission" | "legacy";

/** 後台禁抓名單的一列；artwork_id 空字串＝整個畫師 */
export interface NekomaidForbidden {
  id: number;
  site: string;
  author_id: string;
  artwork_id: string;
  source: NekomaidForbiddenSource;
  submission_id: number | null;
  note: string;
  created_by: number | null;
  /** 同步 job 是否已把 ES 資料拉掉 */
  is_proceed: boolean;
  finish_time: string | null;
  created_at: string;
  updated_at: string;
  nickname: string;
}

/** 後台禁抓名單的篩選：pending＝待從搜尋移除、done＝已移除 */
export type NekomaidForbiddenStatus = "" | "pending" | "done";

/** 後台新增禁抓；只填作品 ID 時後端會反查畫師 */
export interface NekomaidForbiddenCreateRequest {
  site: string;
  author_id: string;
  artwork_id: string;
  note: string;
}

export type CopyrightClaimStatus = "pending" | "approved" | "rejected";

/** 公開的申告處理結果：刻意不含 email、IP、說明；reviewer_note 只有駁回時有值 */
export interface CopyrightClaim {
  id: number;
  site: string;
  author_id: string;
  artwork_id: string;
  nickname: string;
  status: CopyrightClaimStatus;
  reviewer_note: string;
  created_at: string;
  reviewed_at: string | null;
  /** 目標現在是否在禁抓中（跟申告狀態無關）；禁抓中的站內頁會 404，所以不放連結 */
  is_forbidden: boolean;
}

/** 後台審核列表的一列：多了聯絡資料、IP 與同一 IP 的申告件數 */
export interface CopyrightClaimAdminItem extends Omit<
  CopyrightClaim,
  "is_forbidden"
> {
  contact_email: string;
  message: string;
  ip: string;
  ip_count: number;
  reviewed_by: number | null;
}

/** 作品頁送出的版權申告；artwork_id 留空＝整個畫師，website 是 honeypot */
export interface CopyrightClaimSubmitRequest {
  site: string;
  author_id: string;
  artwork_id: string;
  contact_email: string;
  message: string;
  website: string;
}

/** 送出後拿到送出者 IP 的 hash，查詢網址 /copyright-claim/:hash 用 */
export interface CopyrightClaimSubmitResult {
  hash: string;
  status: CopyrightClaimStatus;
}
