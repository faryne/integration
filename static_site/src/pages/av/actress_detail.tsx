import { ActressDetail } from "@/components/av/actress_detail.tsx";
import { useParams, useSearchParams } from "react-router-dom";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { actressRefOf, useRoutedActress } from "@/helpers/avActressRef.ts";
import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import { findActressTopic } from "@/helpers/avActressTopic.ts";
import type { ActressVideoTab } from "@/components/av/actress_detail.tsx";

export function AVActressDetail() {
  const { name = "" } = useParams<{ name: string }>();
  // 出演影片的頁碼存在網址（?page=N），分頁可以直接分享、上一頁也回得去；換女優時網址不帶 page，自然回到第 1 頁
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedPage = Number(searchParams.get("page"));
  const videoPage =
    Number.isInteger(parsedPage) && parsedPage > 1 ? parsedPage : 1;
  // 只動 page，網址上指定女優的 xcity_id／manual_id／dmm_id 要留著
  const setVideoPage = (page: number) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (page > 1) next.set("page", String(page));
      else next.delete("page");
      return next;
    });
  // 網址帶 xcity_id／manual_id／dmm_id 時指定那一位，沒帶就照名字找同名排第一的
  const { actress, sameNames, notFound } = useRoutedActress(name);
  // 從有類型條件的主題點進來（?topic=）時，出演影片每個類型條件各多一個「該類型作品」tab，預設選第一個；
  // ?tab=<類型> 選其他類型、?tab=all 是全部作品，亂填的值當成第一個類型。
  // 主題資料還沒讀到前先不查影片，避免先查全部、再換成類型查第二次
  const topicSlug = searchParams.get("topic") ?? "";
  const topicIndex = useActressTopicIndex(!!topicSlug);
  const genreTags =
    findActressTopic(topicIndex.data, topicSlug)?.topic.genre_tags ?? [];
  const tabParam = searchParams.get("tab") ?? "";
  const videoTab: ActressVideoTab =
    !genreTags.length || tabParam === "all"
      ? "all"
      : genreTags.includes(tabParam)
        ? tabParam
        : genreTags[0];
  // 換 tab 時回到第 1 頁；第一個類型是預設值，網址不用帶
  const setVideoTab = (tab: ActressVideoTab) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("page");
      if (tab === genreTags[0]) next.delete("tab");
      else next.set("tab", tab);
      return next;
    });
  // 一律用這位自己的 ID 查出演影片，同名的人才分得開（舊網址也一樣）
  const videoQuery = useAVVideoSearch(
    {
      page: videoPage,
      actress: name,
      ...(actress && actressRefOf(actress)),
      ...(videoTab !== "all" && { tag: [videoTab] }),
    },
    !!actress && (!topicSlug || !topicIndex.isPending),
  );

  if (!name || notFound) {
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
        pageName={name}
        onVideoPageChange={setVideoPage}
        sameNames={sameNames}
        videoTabs={
          genreTags.length
            ? { tags: genreTags, value: videoTab, onChange: setVideoTab }
            : undefined
        }
        videoPage={videoPage}
        videos={videoQuery}
      />
    </AgeConfirmationGate>
  );
}
