import type { AccountLinkBadge, LayoutMenuItem } from "@/types/layout.ts";
import { usePendingActressSubmissionCount } from "@/apis/av/actress_submission.ts";

/**
 * 帳號選單連結的待處理數量（例如待審核的女優上稿）；選單上沒有對應連結時不查詢。
 * 之後有其他種類時在這裡加一個查詢並放進回傳值
 */
export function useAccountLinkBadges(
  links: LayoutMenuItem[],
): Partial<Record<AccountLinkBadge, number>> {
  const pending = usePendingActressSubmissionCount(
    links.some((l) => l.badge === "avActressSubmissions"),
  );
  return { avActressSubmissions: pending.data ?? 0 };
}
