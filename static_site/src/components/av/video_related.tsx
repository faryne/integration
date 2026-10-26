import type { Video } from "@/types/av.ts";
import { Box } from "@mui/material";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";

/** tab 內的相關作品格狀列表 */
export function RelatedVideoGrid({ videos }: { videos: Video[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(auto-fill, minmax(100px, 1fr))",
          md: "repeat(auto-fill, minmax(128px, 1fr))",
        },
      }}
    >
      {videos.map((v) => (
        <VideoCoverCard key={v.no} video={v} />
      ))}
    </Box>
  );
}
