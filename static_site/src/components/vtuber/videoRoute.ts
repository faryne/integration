import { useCallback } from "react";
import { type Location, useLocation, useNavigate } from "react-router-dom";

import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

// 每部影片一個網址（分享、SEO 都對這個），站內點開時原本的頁面墊在 modal 後面不動
export const vtuberVideoPath = (videoId: string) =>
  `/data/vtubers/videos/${videoId}`;

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
      navigate(vtuberVideoPath(video.videoId), {
        state: { background: location, video } satisfies VideoRouteState,
      }),
    [navigate, location],
  );
}
