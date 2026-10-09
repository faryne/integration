// 檢舉／站方處置理由的顯示文字。後端只存 slug；導入全站 i18n 後這裡改成
// t(`moderation.reason.${slug}`)，namespace 只在這一處加，呼叫端不用動。
const LABELS: Record<string, string> = {
  spam: "廣告、洗版",
  harassment: "騷擾、人身攻擊",
  hate_speech: "仇恨言論",
  unmarked_adult_content: "限制級內容未標示",
  copyright: "抄襲、侵權",
  impersonation: "冒充他人",
  personal_info: "洩漏他人個資",
  illegal_content: "違法內容",
  other: "其他",
  tos_violation: "違反服務條款",
};

export function moderationReasonLabel(slug: string) {
  return LABELS[slug] ?? "違反社群規範";
}

// 站方移除的補述，例如「已由站方移除，原因：廣告、洗版」
export function removedByStaffText(slug: string) {
  return `已由站方移除，原因：${moderationReasonLabel(slug)}`;
}
