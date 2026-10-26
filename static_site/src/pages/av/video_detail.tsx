import { useAVVideoSearch } from "@/apis/av/video_search.ts";
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
        onSynced={(result) => {
          // 同步後 ES 的 no 可能改成小寫，網址換成官方番號，並讓舊的查詢結果失效重抓
          void queryClient.invalidateQueries({
            queryKey: [{ no }, "av/video"],
            exact: false,
          });
          navigate(`/av/video/${encodeURIComponent(result.maker_no)}`, {
            replace: true,
          });
        }}
      />
    </AgeConfirmationGate>
  );
}
