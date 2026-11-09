import type { Video } from "@/types/av.ts";
import { useMemo, useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import {
  relatedVideoTabs,
  type RelatedTab,
} from "@/components/av/relatedVideoTabs.ts";
import { RelatedVideoPanel } from "@/components/av/video_related.tsx";
import { ImageViewer } from "@/components/common/ImageViewer.tsx";
import { useComments } from "@/apis/av/joyu_comments.ts";
import { CommentSection } from "@/components/joyu/comments/CommentSection.tsx";

// 圖片預覽、討論 tab 的 key；其餘 tab 的 key 來自 relatedVideoTabs
const PREVIEW_KEY = "preview";
const COMMENTS_KEY = "comments";

/**
 * 詳細頁的 tab：有圖片時第一個是「圖片預覽」（預設顯示），接著「討論（N）」，後面是「同系列／各女優／同監督／同品牌」相關作品
 * （「基本資料」表格已拿掉，資料改在標題下方的 VideoMetaRows）。
 * 相關作品切換到該 tab 才查詢（RelatedVideoPanel 只在選中時掛載），查過的結果由 react-query 快取；
 * 預設停在第一個 tab，換到別部影片時由父層用 key 重置
 */
export function VideoDetailTabs({ video }: { video: Video }) {
  const photos = useMemo(
    () =>
      video.images.map((image) => ({
        thumb: image.thumb,
        url: image.preview || image.thumb,
      })),
    [video.images],
  );
  // 討論版的留言數放在 tab 標題（第 1 頁的查詢跟討論面板共用快取）
  const target = `video:${video.no.toLowerCase()}`;
  const commentCount = useComments(target).data?.count;
  // 圖片預覽、討論沒有 filter，用 key 區分要顯示哪個面板
  const tabs = useMemo<
    (RelatedTab | { key: string; label: string; filter?: undefined })[]
  >(
    () => [
      ...(photos.length > 0 ? [{ key: PREVIEW_KEY, label: "圖片預覽" }] : []),
      {
        key: COMMENTS_KEY,
        label: commentCount ? `討論（${commentCount}）` : "討論",
      },
      ...relatedVideoTabs(video),
    ],
    [video, photos.length, commentCount],
  );
  const [active, setActive] = useState("");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;

  return (
    <Box>
      <Tabs
        allowScrollButtonsMobile
        onChange={(_, value: string) => setActive(value)}
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        value={current.key}
        variant="scrollable"
      >
        {tabs.map((t) => (
          <Tab key={t.key} label={t.label} value={t.key} />
        ))}
      </Tabs>
      {current.key === COMMENTS_KEY ? (
        <CommentSection target={target} />
      ) : current.filter ? (
        <RelatedVideoPanel
          key={current.key}
          current={video}
          filter={current.filter}
        />
      ) : (
        <ImageViewer photos={photos} title={video.title} />
      )}
    </Box>
  );
}
