import type { Video } from "@/types/av.ts";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { relatedVideoTabs } from "@/components/av/relatedVideoTabs.ts";
import { RelatedVideoPanel } from "@/components/av/video_related.tsx";

/**
 * 詳細頁的「基本資料／同系列／各女優／同監督／同品牌」tab。
 * 相關作品切換到該 tab 才查詢（RelatedVideoPanel 只在選中時掛載），查過的結果由 react-query 快取；
 * 換到別部影片時由父層用 key 重置回基本資料
 */
export function VideoDetailTabs({
  info,
  video,
}: {
  info: ReactNode;
  video: Video;
}) {
  const tabs = useMemo(() => relatedVideoTabs(video), [video]);
  const [active, setActive] = useState("info");
  const current = tabs.find((t) => t.key === active);

  return (
    <Box>
      <Tabs
        allowScrollButtonsMobile
        onChange={(_, value: string) => setActive(value)}
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        value={current ? current.key : "info"}
        variant="scrollable"
      >
        <Tab label="基本資料" value="info" />
        {tabs.map((t) => (
          <Tab key={t.key} label={t.label} value={t.key} />
        ))}
      </Tabs>
      {current ? (
        <RelatedVideoPanel
          key={current.key}
          current={video}
          filter={current.filter}
        />
      ) : (
        info
      )}
    </Box>
  );
}
