import type { Video } from "@/types/av.ts";

// 即將發售的共用小工具

/**
 * 預約作品（還沒配信）：後端標 PRE_ORDER，而且配信日在明天以後（日本時間）。
 * 配信當天每日同步還沒覆寫前，release_status 還留著，用日期再擋一次，就不會顯示成「預約中」
 */
export const isUpcoming = (v: Pick<Video, "release_status" | "vod_date">) =>
  v.release_status === "PRE_ORDER" &&
  v.vod_date.replace(/\//g, "-") > jstDatePlus(0);

/** 配信日 2026/11/20 → 11/20 */
export const shortDate = (vodDate: string) =>
  vodDate.replace(/^\d{4}[/-]0?(\d+)[/-]0?(\d+).*$/, "$1/$2");

/** 日本時間的今天往後 n 天（yyyy-MM-dd），給 end_date 用 */
export function jstDatePlus(days: number) {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
}
