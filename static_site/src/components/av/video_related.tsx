import type { Video } from "@/types/av.ts";
import { Box, Skeleton, Typography } from "@mui/material";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";

// 桌機 8 欄 × 2 排剛好排滿，不會留空位
const RELATED_LIMIT = 16;

// 平板 4 欄、桌機 8 欄的格狀（16 筆剛好排滿）；手機改成可左右滑的 carousel
const listSx = {
  display: { xs: "flex", sm: "grid" },
  gap: 1.5,
  gridTemplateColumns: {
    sm: "repeat(4, minmax(0, 1fr))",
    md: "repeat(8, minmax(0, 1fr))",
  },
  overflowX: { xs: "auto", sm: "visible" },
  pb: { xs: 1, sm: 0 },
  scrollSnapType: { xs: "x mandatory", sm: "none" },
  // 手機一次露出兩張半，提示可以往右滑
  "& > *": {
    flex: { xs: "0 0 40%", sm: "initial" },
    scrollSnapAlign: { xs: "start", sm: "none" },
  },
} as const;

/** 相關作品 tab 的內容：掛載（切到該 tab）時才查詢；排除目前這部，最多 16 筆 */
export function RelatedVideoPanel({
  current,
  filter,
}: {
  current: Video;
  filter: Partial<VideoSearchRequest>;
}) {
  const result = useAVVideoSearch({ page: 1, ...filter });
  // 新舊資料的 no 大小寫不一，比對時一律轉小寫
  const videos = (result.data?.data?.data ?? [])
    .filter((v) => v.no.toLowerCase() !== current.no.toLowerCase())
    .slice(0, RELATED_LIMIT);

  if (result.isPending) {
    return (
      <Box sx={listSx}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            sx={{ aspectRatio: AV_COVER_ASPECT_RATIO, height: "auto" }}
            variant="rounded"
          />
        ))}
      </Box>
    );
  }
  if (videos.length === 0) {
    return (
      <Typography
        color="text.secondary"
        sx={{ py: 3, textAlign: "center" }}
        variant="body2"
      >
        沒有其他作品
      </Typography>
    );
  }
  return (
    <Box sx={listSx}>
      {videos.map((v) => (
        <VideoCoverCard key={v.no} video={v} />
      ))}
    </Box>
  );
}
