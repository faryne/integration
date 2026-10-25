import { useCallback, useEffect } from "react";
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";

import { useVtuberVideoDetail } from "@/apis/opendata/vtubers.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { VideoModal } from "@/components/vtuber/VideoModal.tsx";
import {
  isVideoId,
  normalizeHandle,
  talentPath,
  type VideoRouteState,
  vtuberVideoPath,
} from "@/components/vtuber/routes.ts";
import { useVtuberSnack } from "@/components/vtuber/useVtuberSnack.ts";
import { VtuberTalent } from "@/pages/opendata/vtuber_talent.tsx";
import { VtuberWall } from "@/pages/opendata/vtuber_wall.tsx";
import { VtubersIndex } from "@/pages/opendata/vtubers.tsx";

/**
 * /data/vtubers/*：總覽、藝人頁（含分頁）、影片網址（/@name/videos/:videoId）。
 * 站內點開影片時用 history state 的 background 繼續渲染原頁面（不重新掛載，捲動與分頁都保留），modal 疊在上面；
 * 直接打開影片網址沒有 background，墊該藝人的「所有影片」分頁，關閉後就停在那裡。
 * 找不到影片／藝人的 snack 放在這一層，跳轉後才不會跟著頁面一起消失。
 */
export function VtuberSection() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    snack,
    showError,
    showErrorMessage,
    close: closeSnack,
  } = useVtuberSnack();
  const { background, video } = (location.state ?? {}) as VideoRouteState;
  // 用 * 接住 videos 後面的整段，ID 帶斜線（含編碼過的 %2F）或格式不對都能一起擋
  const params = useMatch("/data/vtubers/:handle/videos/*")?.params;
  const handle = params?.handle ?? "";
  const rawId = params?.["*"] ?? "";
  const videoId = isVideoId(rawId) ? rawId : undefined;

  // modal 查不到影片時會在 effect 裡呼叫，要穩定的參照才不會重複觸發
  const close = useCallback(
    () =>
      background
        ? navigate(-1)
        : navigate(talentPath(handle, "videos"), { replace: true }),
    [background, handle, navigate],
  );
  const videoMissing = useCallback(
    (error: unknown) => {
      showError(error);
      close();
    },
    [showError, close],
  );
  const talentMissing = useCallback(
    (error: unknown) => {
      // 影片網址先等影片結果：影片找得到會換成正確的藝人；找不到時關掉 modal、videoId 清空後才輪到這裡
      if (videoId) return;
      showError(error);
      navigate("/data/vtubers", { replace: true });
    },
    [videoId, showError, navigate],
  );

  // ID 格式不對：不打 API，直接當成找不到
  const invalidId = rawId !== "" && !videoId;
  useEffect(() => {
    if (!invalidId) return;
    showErrorMessage("找不到這部影片");
    navigate(talentPath(handle, "videos"), { replace: true });
  }, [invalidId, handle, showErrorMessage, navigate]);

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
        {/* 靜態路徑排在 :handle 前面比對；入口在總覽「直播中」標題旁 */}
        <Route path={"wall"} element={<VtuberWall />} />
        {/* 分頁與影片都在藝人頁裡依 * 判斷，同一個 route 才不會切分頁就重新掛載 */}
        <Route
          path={":handle/*"}
          element={<VtuberTalent onNotFound={talentMissing} />}
        />
      </Routes>
      <VideoModal
        videoId={videoId}
        initial={video?.videoId === videoId ? video : undefined}
        onClose={close}
        onMissing={videoMissing}
      />
      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        onClose={closeSnack}
      />
    </>
  );
}
