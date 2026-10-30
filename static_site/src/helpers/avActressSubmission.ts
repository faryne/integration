import type {
  ActressSubmissionStatus,
  ActressSubmissionSummary,
} from "@/types/avActressSubmission.ts";

export const SUBMISSION_STATUS_LABEL: Record<ActressSubmissionStatus, string> =
  {
    pending: "待審核",
    approved: "已核准",
    rejected: "已否決",
  };

export const SUBMISSION_STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  rejected: "error",
} as const;

export const SUBMISSION_RESOLUTION_LABEL = {
  "": "",
  created: "新增",
  updated: "修改",
  merged: "合併到既有女優",
};

/** 提交者：有登入顯示會員編號，匿名顯示 IP 雜湊前四碼 */
export function submitterLabel(s: ActressSubmissionSummary) {
  if (s.submitter_user_id) return `會員 #${s.submitter_user_id}`;
  return s.ip_hash_prefix ? `匿名（IP ${s.ip_hash_prefix}…）` : "匿名";
}

export function formatSubmissionTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  });
}
