import type { AccountLinkBadge, LayoutMenuItem } from "@/types/layout.ts";
import { useBackendAdminPendingCounts } from "@/apis/backendAdmin/pendingCounts.ts";

/**
 * 帳號選單連結的待處理數量；選單上沒有對應連結時不查詢。
 * backendAdmin：整合後台各模組待處理數量的加總。之後有其他種類時在這裡加一個查詢並放進回傳值
 */
export function useAccountLinkBadges(
  links: LayoutMenuItem[],
): Partial<Record<AccountLinkBadge, number>> {
  const counts = useBackendAdminPendingCounts(
    links.some((l) => l.badge === "backendAdmin"),
  );
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  return { backendAdmin: total };
}
