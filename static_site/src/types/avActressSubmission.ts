import type { ActressLink } from "@/types/av.ts";

/** 上稿可編輯的女優欄位（與後端 ActressFields 同格式） */
export interface ActressFields {
  name: string;
  kana: string;
  photo: string;
  height: number;
  bust: number;
  waist: number;
  hips: number;
  cup: string;
  blood: string;
  born_city: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  interests: string[];
  links: ActressLink[];
  // 別名（不含本名）
  aliases: string[];
}

export type ActressFieldKey = keyof ActressFields;

export type ActressSubmissionKind = "create" | "edit";
export type ActressSubmissionStatus = "pending" | "approved" | "rejected";

export interface ActressCandidate {
  domain: string;
  aid: number;
  exact_name: boolean;
  fields: ActressFields;
}

export interface ActressSubmitRequest {
  kind: ActressSubmissionKind;
  target_domain?: string;
  target_aid?: number;
  fields: ActressFields;
}

export interface ActressSubmitResult {
  id: number;
  status: ActressSubmissionStatus;
  changed_fields: ActressFieldKey[];
  duplicates: ActressCandidate[];
}

export interface ActressSubmissionSummary {
  id: number;
  kind: ActressSubmissionKind;
  target_domain: string;
  target_aid: number;
  channel: "web" | "mcp";
  submitter_user_id: number | null;
  status: ActressSubmissionStatus;
  resolution: "" | "created" | "updated" | "merged";
  merged_domain: string;
  merged_aid: number;
  reviewer_user_id: number | null;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  name: string;
  changed_fields: ActressFieldKey[];
  ip_hash_prefix: string;
  conflict: boolean;
  duplicate: boolean;
}

export interface ActressSubmissionDetail extends ActressSubmissionSummary {
  payload: ActressFields;
  base: ActressFields | null;
  current: ActressFields | null;
  duplicates: ActressCandidate[];
}
