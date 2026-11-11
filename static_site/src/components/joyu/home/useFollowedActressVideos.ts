import { useJoyuFeed } from "@/apis/av/joyu_me.ts";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import type { Video } from "@/types/av.ts";

// 首頁只看最近 7 天
export const FOLLOWED_DAYS = 7;

/**
 * 首頁「你追蹤的女優新片」的資料：最近 7 天、只取女優類型的追蹤（標籤這類量大的條件不放首頁），
 * 把各女優的新片合在一起依配信日排、同一部只留一次。原版面的獨立區塊與一屏版「新片」的分頁共用
 */
export function useFollowedActressVideos(limit: number) {
  const { user } = useJoyuAuth();
  const feed = useJoyuFeed(user?.uid, FOLLOWED_DAYS);
  const seen = new Set<string>();
  const videos = (feed.data?.sections ?? [])
    .filter((s) => s.kind === "actress")
    .flatMap((s) => s.videos)
    .filter((v: Video) => !seen.has(v.no) && !!seen.add(v.no))
    .sort((a, b) => b.vod_date.localeCompare(a.vod_date));
  return { total: videos.length, videos: videos.slice(0, limit) };
}
