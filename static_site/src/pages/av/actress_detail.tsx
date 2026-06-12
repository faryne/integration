import { ActressDetail } from "@/components/av/actress_detail.tsx";
import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { useParams } from "react-router-dom";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { useEffect, useState } from "react";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";

export function AVActressDetail() {
  const { name } = useParams<{ name: string }>();
  const [videoPage, setVideoPage] = useState(1);
  const s = useAVActressSearch({ name, page: 1 }, !!name);
  const actress = s.data?.data?.data?.[0];
  const videoQuery = useAVVideoSearch(
    { page: videoPage, actress: name },
    !!name && !!actress,
  );

  useEffect(() => {
    setVideoPage(1);
  }, [name]);

  if (!name || (s.isSuccess && !actress)) {
    return (
      <ErrorPage
        backUrl="/av/actress"
        code={404}
        message={
          name
            ? `找不到「${name}」的女優資料。可能資料尚未建立，或名稱與資料庫記錄不一致。`
            : "找不到指定的女優資料。"
        }
      />
    );
  }

  return (
    <AgeConfirmationGate
      description="AV 女優詳細頁包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/av/actress"
      panelTitle="AV 女優詳細頁需要年齡確認"
    >
      <ActressDetail
        actress={actress}
        onVideoPageChange={setVideoPage}
        videoPage={videoPage}
        videos={videoQuery}
      />
    </AgeConfirmationGate>
  );
}
