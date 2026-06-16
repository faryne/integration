import { Stack, Typography } from "@mui/material";

import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import type { GalgameVideo } from "@/types/galgame.ts";

export function RelatedVideoList({
  error,
  loading,
  videos,
  showTitle = true,
}: {
  error: boolean;
  loading: boolean;
  videos: GalgameVideo[];
  showTitle?: boolean;
}) {
  return (
    <Stack spacing={1.5}>
      {showTitle && (
        <Typography variant="h5" component="h2">
          相關影片
        </Typography>
      )}
      {loading ? (
        <GalgameState loading message="正在載入相關影片..." />
      ) : error ? (
        <GalgameState severity="error" message="相關影片載入失敗。" />
      ) : videos.length === 0 ? (
        <GalgameState message="目前沒有相關影片。" />
      ) : (
        videos.map((video) => (
          <GalgameVideoCard
            key={video.youtube_video_id}
            video={video}
            variant="simple"
          />
        ))
      )}
    </Stack>
  );
}
