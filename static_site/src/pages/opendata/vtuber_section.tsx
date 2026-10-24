import { useCallback, useEffect } from "react";
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";

import { useVtuberVideoDetail } from "@/apis/opendata/vtubers.ts";
import { VideoModal } from "@/components/vtuber/VideoModal.tsx";
import {
  normalizeHandle,
  talentPath,
  type VideoRouteState,
  vtuberVideoPath,
} from "@/components/vtuber/routes.ts";
import { VtuberTalent } from "@/pages/opendata/vtuber_talent.tsx";
import { VtubersIndex } from "@/pages/opendata/vtubers.tsx";

/**
 * /data/vtubers/*：總覽、藝人頁（含分頁）、影片網址（/@name/videos/:videoId）。
 * 站內點開影片時用 history state 的 background 繼續渲染原頁面（不重新掛載，捲動與分頁都保留），modal 疊在上面；
 * 直接打開影片網址沒有 background，墊該藝人的「所有影片」分頁，關閉後就停在那裡。
 */
export function VtuberSection() {
  const location = useLocation();
  const navigate = useNavigate();
  const { background, video } = (location.state ?? {}) as VideoRouteState;
  const params = useMatch("/data/vtubers/:handle/videos/:videoId")?.params;
  const { handle = "", videoId } = params ?? {};
  // modal 查不到影片時會在 effect 裡呼叫，要穩定的參照才不會重複觸發
  const close = useCallback(
    () =>
      background
        ? navigate(-1)
        : navigate(talentPath(handle, "videos"), { replace: true }),
    [background, handle, navigate],
  );

  // 網址的 handle 跟影片的頻道對不上（打錯、藝人改了 handle）就換成正確的網址，history state 照帶
  const detail = useVtuberVideoDetail(videoId);
  const actual = detail.data?.channel_handle;
  useEffect(() => {
    if (
      videoId &&
      actual &&
      actual.toLowerCase() !== normalizeHandle(handle).toLowerCase()
    )
      navigate(vtuberVideoPath(actual, videoId), {
        replace: true,
        state: location.state,
      });
  }, [videoId, actual, handle, navigate, location.state]);

  return (
    <>
      <Routes location={background ?? location}>
        <Route index element={<VtubersIndex />} />
        {/* 分頁與影片都在藝人頁裡依 * 判斷，同一個 route 才不會切分頁就重新掛載 */}
        <Route path={":handle/*"} element={<VtuberTalent />} />
      </Routes>
      <VideoModal
        videoId={videoId}
        initial={video?.videoId === videoId ? video : undefined}
        onClose={close}
      />
    </>
  );
}
