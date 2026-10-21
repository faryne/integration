import { Box, Grid, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  useGalgameVideo,
  useRelatedGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { VideoViewer } from "@/components/common/VideoViewer.tsx";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { RelatedVideoList } from "@/components/galgame/RelatedVideoList.tsx";
import { VideoInfoCard } from "@/components/galgame/video/VideoInfoCard.tsx";
import { VideoPrevNext } from "@/components/galgame/video/VideoPrevNext.tsx";
import { useTitle } from "@/helpers/title.tsx";

/** 影片頁：主欄是播放器、標題、作品資訊卡、介紹、上一則／下一則；側欄是同作品與相關影片 */
export default function GalgameVideo() {
  const { t } = useTranslation();
  const { brandSlug, videoId } = useParams();
  const query = useGalgameVideo(brandSlug, videoId);
  const related = useRelatedGalgameVideos(brandSlug, videoId);
  const video = query.data;
  useTitle(video?.title ?? t("galgame.video.pageTitleFallback"));

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb
        brand={
          video
            ? { public_id: video.brand_public_id, name: video.brand_name }
            : undefined
        }
        videoTitle={video?.title}
      />
      {query.isPending ? (
        <GalgameState loading message={t("galgame.video.loading")} />
      ) : query.isError || !video ? (
        <GalgameState severity="error" message={t("galgame.video.notFound")} />
      ) : (
        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 8 }}>
            <VideoViewer
              title={video.title}
              videos={[
                {
                  autoPlay: true,
                  url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
                  thumb: video.thumbnail_url,
                },
              ]}
            />
            <Typography
              variant="h5"
              component="h1"
              fontWeight={800}
              sx={{ mt: 2, mb: 1.5, lineHeight: 1.4 }}
            >
              {video.title}
            </Typography>
            <VideoInfoCard
              video={video}
              brandSlug={brandSlug}
              videoId={videoId}
            />
            <Box component="section" sx={{ mt: 3 }}>
              <Typography
                variant="h6"
                component="h2"
                fontWeight={700}
                sx={{ mb: 1 }}
              >
                {t("galgame.video.description")}
              </Typography>
              {video.description ? (
                <ExpandableText text={video.description} collapsedLines={4} />
              ) : (
                <Typography color="text.secondary">
                  {t("galgame.video.noDescription")}
                </Typography>
              )}
            </Box>
            <VideoPrevNext brandSlug={brandSlug} videoId={videoId} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <RelatedVideoList
              video={video}
              loading={related.isPending}
              error={related.isError}
              videos={related.data ?? []}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
