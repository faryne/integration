import { Link as RouterLink } from "react-router-dom";
import { Box, Link, Stack, Typography } from "@mui/material";

import { useUpcoming } from "@/apis/av/upcoming.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import type { ActressRef } from "@/helpers/avActressRef.ts";
import { joyuPath } from "@/helpers/joyu.ts";

/** 女優頁作品區上方的「即將發售」：這位（這個名義）未來 30 天的預約作品，橫向一列；沒有就不顯示 */
export function ActressUpcoming({
  params,
}: {
  params: ActressRef & { actress: string[] };
}) {
  const q = useUpcoming(params);
  const videos = q.data?.data ?? [];
  if (videos.length === 0) return null;

  return (
    <Box component="section" sx={{ mb: 3, textAlign: "left" }}>
      <Stack direction="row" gap={1} sx={{ alignItems: "baseline", mb: 1 }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 800 }}>
          即將發售
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
          {q.data?.total} 部
        </Typography>
        <Link
          component={RouterLink}
          sx={{ fontSize: 13, ml: "auto" }}
          to={joyuPath("upcoming")}
          underline="hover"
        >
          即將發售 →
        </Link>
      </Stack>
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          scrollSnapType: "x mandatory",
          "& > *": {
            flex: { xs: "0 0 120px", md: "0 0 calc((100% - 60px) / 6)" },
            scrollSnapAlign: "start",
          },
        }}
      >
        {videos.map((v) => (
          <VideoCoverCard key={v.no} video={v} />
        ))}
      </Box>
    </Box>
  );
}
