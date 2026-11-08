import { Box, Skeleton } from "@mui/material";

import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";

// 影片為輔：首頁只放一排
const LATEST_LIMIT = 6;

/** 首頁「最新上架影片」：影片搜尋的預設結果（依配信日由新到舊）取前幾筆 */
export function LatestVideosSection() {
  const q = useAVVideoSearch({ page: 1 });
  const videos = (q.data?.data?.data ?? []).slice(0, LATEST_LIMIT);

  return (
    <HomeSection
      title="最新上架影片"
      moreTo={joyuPath("video")}
      moreLabel="影片搜尋"
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(6, 1fr)",
          },
        }}
      >
        {q.isPending
          ? Array.from({ length: LATEST_LIMIT }, (_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ height: 260 }} />
            ))
          : videos.map((v) => <VideoCoverCard key={v.no} video={v} />)}
      </Box>
      <ErrorSnack open={q.isError} message="最新影片讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
