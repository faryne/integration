import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { useParams } from "react-router-dom";
import { VideoDetail } from "@/components/av/video_detail.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

export function AVVideoDetail() {
  const { no } = useParams<{ no: string }>();
  const v = useAVVideoSearch({ page: 1, no }, !!no);
  const video = v.data?.data?.data?.[0];

  if (!no || (v.isSuccess && !video)) {
    return (
      <ErrorPage
        backUrl="/av/video"
        code={404}
        message={
          no
            ? `找不到番號「${no}」的影片資料。可能資料尚未建立，或番號與資料庫記錄不一致。`
            : "找不到指定的影片資料。"
        }
      />
    );
  }

  return <VideoDetail video={video} />;
}
