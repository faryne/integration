import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
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
          <Card key={video.youtube_video_id} variant="outlined">
            <CardActionArea
              component={RouterLink}
              to={galgamePath(
                `${galgameBrandSlug(video.brand_public_id, video.brand_name)}/video/${video.youtube_video_id}`,
              )}
            >
              <Stack direction="row">
                <CardMedia
                  component="img"
                  image={video.thumbnail_url}
                  alt={video.title}
                  sx={{
                    width: 144,
                    minHeight: 82,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <CardContent
                  sx={{ minWidth: 0, p: 1.25, "&:last-child": { pb: 1.25 } }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      display: "-webkit-box",
                      overflow: "hidden",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                    }}
                  >
                    {video.title}
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Typography
                      variant="caption"
                      color="primary"
                      display="block"
                      noWrap
                    >
                      {video.brand_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(video.published_at).toLocaleDateString("zh-TW")}
                    </Typography>
                  </Box>
                </CardContent>
              </Stack>
            </CardActionArea>
          </Card>
        ))
      )}
    </Stack>
  );
}
