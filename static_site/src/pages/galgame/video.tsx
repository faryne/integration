import { Alert, Box, Button, Link, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link as RouterLink, useParams } from "react-router-dom";

import { useGalgameVideo } from "@/apis/galgame/catalog.ts";
import { VideoViewer } from "@/components/common/VideoViewer.tsx";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { galgameBrandSlug } from "@/helpers/galgame.ts";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameVideo() {
  const { brandSlug, videoId } = useParams();
  const query = useGalgameVideo(brandSlug, videoId);
  const video = query.data;
  useTitle(video?.title ?? "Galgame 影片");

  if (query.isError) {
    return <Alert severity="error">影片不存在或載入失敗。</Alert>;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb
        brand={video ? { public_id: video.brand_public_id, name: video.brand_name } : undefined}
        videoTitle={video?.title}
      />
      {video && (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
              {video.title}
            </Typography>
            <Button
              component="a"
              href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              endIcon={<OpenInNewIcon />}
            >
              YouTube
            </Button>
          </Stack>
          <VideoViewer
            title={video.title}
            videos={[{
              url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
              thumb: video.thumbnail_url,
            }]}
          />
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Link
              component={RouterLink}
              to={`/galgame/${galgameBrandSlug(video.brand_public_id, video.brand_name)}`}
              variant="subtitle2"
              underline="hover"
            >
              {video.brand_name}
            </Link>
            <Typography variant="subtitle2" color="text.secondary">
              · {new Date(video.published_at).toLocaleDateString("zh-TW")} ·
            </Typography>
            <Link
              href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtitle2"
              underline="hover"
            >
              前往 YouTube
            </Link>
          </Stack>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{video.description}</Typography>
        </Stack>
      )}
    </Box>
  );
}
