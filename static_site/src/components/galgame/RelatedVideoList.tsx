import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <Stack spacing={1.5}>
      {showTitle && (
        <Typography variant="h5" component="h2">
          {t("galgame.related.heading")}
        </Typography>
      )}
      {loading ? (
        <GalgameState loading message={t("galgame.related.loading")} />
      ) : error ? (
        <GalgameState severity="error" message={t("galgame.related.error")} />
      ) : videos.length === 0 ? (
        <GalgameState message={t("galgame.related.empty")} />
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
