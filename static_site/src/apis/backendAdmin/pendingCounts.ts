import { usePendingActressSubmissionCount } from "@/apis/av/actress_submission.ts";
import { usePendingVideoSubmissionCount } from "@/apis/av/video_submission.ts";
import {
  useAdminGalgameBrands,
  useAdminGalgameVideoSubmissions,
} from "@/apis/galgame/admin.ts";
import type { BackendAdminBadge } from "@/data/backendAdminNav.ts";

/**
 * 整合後台各模組的待處理數量（側欄 badge、總覽卡片、帳號選單共用）。
 * 不另開 API：沿用各模組列表 API 只拿 1 筆取 total；查詢失敗時該欄位是 undefined，畫面就不顯示數字
 */
export function useBackendAdminPendingCounts(
  enabled = true,
): Partial<Record<BackendAdminBadge, number>> {
  const av = usePendingActressSubmissionCount(enabled);
  const avVideos = usePendingVideoSubmissionCount(enabled);
  // 查詢本身也只在管理者登入時才送出
  const brands = useAdminGalgameBrands("pending", 1, 1, "", enabled);
  const videos = useAdminGalgameVideoSubmissions("pending", 1, 1, enabled);
  return {
    avSubmissions: av.data,
    avVideoSubmissions: avVideos.data,
    galgameBrands: brands.data?.total,
    galgameVideos: videos.data?.total,
  };
}
