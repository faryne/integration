import { useCallback } from "react";
import { type Location, useLocation, useNavigate } from "react-router-dom";

import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

// 藝人頁的分頁，第一個是預設（網址不帶分頁段）
export const TALENT_TABS = ["upcoming", "videos", "calendar", "stats"] as const;
export type TalentTab = (typeof TALENT_TABS)[number];

// 網址上的 handle 可能不帶 @，比對前補上
export const normalizeHandle = (handle: string) =>
  handle.startsWith("@") ? handle : `@${handle}`;

// 藝人頁網址：/data/vtubers/@name、/data/vtubers/@name/videos …
export const talentPath = (handle: string, tab: TalentTab = "upcoming") =>
  `/data/vtubers/${handle}${tab === "upcoming" ? "" : `/${tab}`}`;

// 每部影片一個網址（分享、SEO 都對這個），掛在上傳頻道的「所有影片」底下
export const vtuberVideoPath = (handle: string, videoId: string) =>
  `${talentPath(handle, "videos")}/${videoId}`;

export interface VideoRouteState {
  background?: Location; // 站內點開時的原頁面；直接打開分享連結時沒有
  video?: VtuberPlayingVideo; // 站內已經有的影片資料，modal 不用等 API
}

/** 站內開影片 modal：換成影片網址，原頁面跟影片資料放進 history state；瀏覽器上一頁就是關閉 */
export function useOpenVideo() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (video: VtuberPlayingVideo) =>
      navigate(vtuberVideoPath(video.channelHandle, video.videoId), {
        state: { background: location, video } satisfies VideoRouteState,
      }),
    [navigate, location],
  );
}
