import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Grid,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link as RouterLink, useParams } from "react-router-dom";

import {
  useGalgameVideo,
  useRelatedGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { VideoViewer } from "@/components/common/VideoViewer.tsx";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import { useTitle } from "@/helpers/title.tsx";
import { RelatedVideoList } from "@/components/galgame/RelatedVideoList.tsx";

export default function GalgameVideo() {
  const { brandSlug, videoId } = useParams();
  const query = useGalgameVideo(brandSlug, videoId);
  const related = useRelatedGalgameVideos(brandSlug, videoId);
  const video = query.data;
  useTitle(video?.title ?? "Galgame 影片");

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
        <GalgameState loading message="正在載入影片..." />
      ) : query.isError || !video ? (
        <GalgameState severity="error" message="影片不存在或載入失敗。" />
      ) : (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
              {video.title}
            </Typography>
          </Stack>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 8 }}>
              <VideoViewer
                title={video.title}
                videos={[
                  {
                    url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
                    thumb: video.thumbnail_url,
                  },
                ]}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Avatar
                    src={video.brand_avatar_url}
                    alt={video.brand_name}
                    sx={{ width: 52, height: 52 }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Link
                      component={RouterLink}
                      to={galgamePath(
                        galgameBrandSlug(
                          video.brand_public_id,
                          video.brand_name,
                        ),
                      )}
                      variant="subtitle1"
                      fontWeight={700}
                      underline="hover"
                    >
                      {video.brand_name}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(video.published_at).toLocaleDateString("zh-TW")}
                    </Typography>
                  </Box>
                  <Button
                    component="a"
                    href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    endIcon={<OpenInNewIcon />}
                  >
                    YouTube
                  </Button>
                </Stack>
                <Accordion disableGutters>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="video-description-content"
                    id="video-description-header"
                  >
                    <Typography variant="h6">影片介紹</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {video.description ? (
                      <ExpandableText
                        text={video.description}
                        collapsedLines={8}
                      />
                    ) : (
                      <Typography color="text.secondary">
                        此影片沒有介紹。
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
                <Accordion defaultExpanded disableGutters>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="related-videos-content"
                    id="related-videos-header"
                  >
                    <Typography variant="h6">相關影片</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <RelatedVideoList
                      loading={related.isPending}
                      error={related.isError}
                      videos={related.data ?? []}
                      showTitle={false}
                    />
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Box>
  );
}
