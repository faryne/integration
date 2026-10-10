import i18n from "@/i18n/index.ts";

// 檢舉／站方處置理由的顯示文字。後端只存 slug，翻譯 key 一律是 moderation.reason.<slug>
// （namespace 只在這裡加）；不認識的 slug 顯示「違反社群規範」。
// 這兩支給非元件的地方（通知文案組字等）用，所以用 i18n.t 而不是 hook。
export function moderationReasonLabel(slug: string) {
  return i18n.t(`moderation.reason.${slug}`, {
    defaultValue: i18n.t("moderation.reason.unknown"),
  });
}

// 站方移除的整句提示（各語系語序不同，所以主詞跟原因一起放進樣板，不拼片段）：
// comment／reply 是留言佔位，notice.comment／notice.post 是通知列表的括號補述
export type RemovedByStaffKind =
  "comment" | "reply" | "notice.comment" | "notice.post";

export function removedByStaffText(kind: RemovedByStaffKind, slug: string) {
  return i18n.t(`moderation.removedByStaff.${kind}`, {
    reason: moderationReasonLabel(slug),
  });
}
