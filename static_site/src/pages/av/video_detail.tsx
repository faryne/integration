import {
  avVideoSearchQueryKey,
  fetchAVVideoSearch,
  useAVVideoSearch,
} from "@/apis/av/video_search.ts";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { VideoDetail } from "@/components/av/video_detail.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";

export function AVVideoDetail() {
  const { no } = useParams<{ no: string }>();
  const v = useAVVideoSearch({ page: 1, no }, !!no);
  const video = v.data?.data?.data?.[0];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!no || (v.isSuccess && !video)) {
    return (
      <ErrorPage
        backUrl="/av/video"
        code={404}
        message={no ? `找不到番號「${no}」的影片。` : "找不到影片。"}
      />
    );
  }

  return (
    <AgeConfirmationGate
      description="AV 影片詳細頁包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/av/video"
      panelTitle="AV 影片詳細頁需要年齡確認"
    >
      <VideoDetail
        video={video}
        onSynced={async (result) => {
          // 後端已確認寫入並可查詢；前端再用官方番號查一次，拿到資料（同時進快取）才換到新網址，
          // replace 讓上一頁不會回到舊的內部番號網址（等同 301）
          const params = { page: 1, no: result.maker_no };
          const data = await queryClient.fetchQuery({
            queryKey: avVideoSearchQueryKey(params),
            queryFn: () => fetchAVVideoSearch(params),
          });
          if (!data.data?.data?.length) {
            throw new Error("synced video not found");
          }
          navigate(`/av/video/${encodeURIComponent(result.maker_no)}`, {
            replace: true,
          });
        }}
        onOrphaned={() => {
          // 已標成 orphan：重新查詢這部，按鈕會依 is_orphan 隱藏
          void queryClient.invalidateQueries({
            queryKey: avVideoSearchQueryKey({ page: 1, no }),
          });
        }}
      />
    </AgeConfirmationGate>
  );
}
