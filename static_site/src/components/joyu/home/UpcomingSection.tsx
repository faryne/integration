import { Box, Skeleton } from "@mui/material";

import { useUpcoming } from "@/apis/av/upcoming.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { jstDatePlus } from "@/helpers/upcoming.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";

const UPCOMING_LIMIT = 12;

/** 首頁「下週發售」：未來 7 天的預約作品，依 DMM 收藏數取前 12 部（只排序、不顯示數字）；沒有預約作品時整區不顯示 */
export function UpcomingSection() {
  const q = useUpcoming({ end_date: jstDatePlus(8), sort: "popular" });
  const videos = (q.data?.data ?? []).slice(0, UPCOMING_LIMIT);
  if (q.isSuccess && videos.length === 0) return null;

  return (
    <HomeSection title="下週發售" moreTo={joyuPath("upcoming")}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(6, minmax(0, 1fr))",
          },
        }}
      >
        {q.isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ height: 260 }} />
            ))
          : videos.map((v) => <VideoCoverCard key={v.no} video={v} />)}
      </Box>
      <ErrorSnack open={q.isError} message="即將發售資料讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
