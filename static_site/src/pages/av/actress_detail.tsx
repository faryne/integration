import { ActressDetail } from "@/components/av/actress_detail.tsx";
import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { useParams, useSearchParams } from "react-router-dom";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";

export function AVActressDetail() {
  const { name } = useParams<{ name: string }>();
  // 出演影片的頁碼存在網址（?page=N），分頁可以直接分享、上一頁也回得去；換女優時網址不帶 page，自然回到第 1 頁
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedPage = Number(searchParams.get("page"));
  const videoPage =
    Number.isInteger(parsedPage) && parsedPage > 1 ? parsedPage : 1;
  const setVideoPage = (page: number) =>
    setSearchParams(page > 1 ? { page: String(page) } : {});
  const s = useAVActressSearch({ name, page: 1 }, !!name);
  // 姓名搜尋是部分比對（「みずき」也會找到「志田みずき」），詳細頁只認完全相符的那位
  const actress = s.data?.data?.data?.find((a) => a.name === name);
  const videoQuery = useAVVideoSearch(
    { page: videoPage, actress: name },
    !!name && !!actress,
  );

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
