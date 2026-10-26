import type { Video } from "@/types/av.ts";
import type { ReactNode } from "react";
import { useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useRelatedVideoGroups } from "@/components/av/useRelatedVideoGroups.ts";
import { RelatedVideoGrid } from "@/components/av/video_related.tsx";

/**
 * 詳細頁的「基本資料／同系列作品／女優的其他作品」tab。
 * 相關作品沒有結果時不出現對應的 tab；換到別部影片時由父層用 key 重置回基本資料
 */
export function VideoDetailTabs({
  info,
  video,
}: {
  info: ReactNode;
  video: Video;
}) {
  const groups = useRelatedVideoGroups(video);
  const [active, setActive] = useState("info");
  // 相關作品是非同步載入的，選中的分組若不存在就退回基本資料
  const current = groups.find((g) => g.key === active);

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
        {groups.map((g) => (
          <Tab key={g.key} label={g.label} value={g.key} />
        ))}
      </Tabs>
      {current ? <RelatedVideoGrid videos={current.videos} /> : info}
    </Box>
  );
}
