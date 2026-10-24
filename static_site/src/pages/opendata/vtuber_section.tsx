import { useCallback } from "react";
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";

import { VideoModal } from "@/components/vtuber/VideoModal.tsx";
import type { VideoRouteState } from "@/components/vtuber/videoRoute.ts";
import { VtuberTalent } from "@/pages/opendata/vtuber_talent.tsx";
import { VtubersIndex } from "@/pages/opendata/vtubers.tsx";

/**
 * /data/vtubers/*：總覽、藝人頁、影片網址（/videos/:videoId）。
 * 站內點開影片時用 history state 的 background 繼續渲染原頁面（不重新掛載，捲動與分頁都保留），modal 疊在上面；
 * 直接打開影片網址沒有 background，墊總覽，關閉後回總覽。
 */
export function VtuberSection() {
  const location = useLocation();
  const navigate = useNavigate();
  const { background, video } = (location.state ?? {}) as VideoRouteState;
  const videoId = useMatch("/data/vtubers/videos/:videoId")?.params.videoId;
  // modal 查不到影片時會在 effect 裡呼叫，要穩定的參照才不會重複觸發
  const close = useCallback(
    () =>
      background ? navigate(-1) : navigate("/data/vtubers", { replace: true }),
    [background, navigate],
  );

  return (
    <>
      <Routes location={background ?? location}>
        <Route index element={<VtubersIndex />} />
        <Route path={"videos/:videoId"} element={<VtubersIndex />} />
        <Route path={":handle"} element={<VtuberTalent />} />
      </Routes>
      <VideoModal
        videoId={videoId}
        initial={video?.videoId === videoId ? video : undefined}
        onClose={close}
      />
    </>
  );
}
