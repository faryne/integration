import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import type { MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import type { GalgameVideo } from "@/types/galgame.ts";
import {
  formatGalgameDuration,
  galgameBrandSlug,
  galgamePath,
} from "@/helpers/galgame.ts";
import { useGalgameVideoFavorite } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

export function GalgameVideoCard({
  video,
  favorite = false,
  variant = "summary",
}: {
  video: GalgameVideo;
  favorite?: boolean;
  variant?: "summary" | "simple";
}) {
  const { session, login, submitting } = useAuth();
  const favoriteQuery = useGalgameVideoFavorite(
    galgameBrandSlug(video.brand_public_id, video.brand_name),
    video.youtube_video_id,
    false,
  );
  const isFavorite = favoriteQuery.data?.favorite ?? favorite;
  const toggleFavorite = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!session) {
      await login();
      return;
    }
    await favoriteQuery.mutation.mutateAsync(!isFavorite);
  };
  const duration = formatGalgameDuration(video.duration_seconds);
  const videoPath = galgamePath(
    `${galgameBrandSlug(video.brand_public_id, video.brand_name)}/video/${video.youtube_video_id}`,
  );
  const media = (
    <Box sx={{ position: "relative", flexShrink: 0 }}>
      <CardMedia
        component="img"
        height={variant === "summary" ? "180" : undefined}
        image={video.thumbnail_url}
        alt={video.title}
        sx={{
          objectFit: "cover",
          width: variant === "simple" ? 144 : "100%",
          minHeight: variant === "simple" ? 82 : undefined,
        }}
      />
      {duration && (
        <Box
          sx={{
            position: "absolute",
            right: 6,
            bottom: 6,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.75,
            bgcolor: "rgba(0, 0, 0, 0.78)",
            color: "common.white",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {duration}
        </Box>
      )}
    </Box>
  );

  return (
    <Card
      variant={variant === "simple" ? "outlined" : undefined}
      sx={{ height: "100%", position: "relative" }}
    >
      <Tooltip title={isFavorite ? "取消收藏影片" : "收藏影片"}>
        <Box
          sx={{
            position: "absolute",
            zIndex: 1,
            top: variant === "simple" ? 6 : 8,
            right: variant === "simple" ? 6 : 8,
            display: "grid",
            placeItems: "center",
            width: variant === "simple" ? 30 : 34,
            height: variant === "simple" ? 30 : 34,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.92)",
            boxShadow: 1,
            color: "warning.main",
          }}
        >
          <IconButton
            size="small"
            color={isFavorite ? "warning" : "default"}
            aria-label={isFavorite ? "取消收藏影片" : "收藏影片"}
            disabled={
              submitting ||
              favoriteQuery.isFetching ||
              favoriteQuery.mutation.isPending
            }
            onClick={(event) => void toggleFavorite(event)}
          >
            {isFavorite ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Box>
      </Tooltip>
      <CardActionArea
        component={RouterLink}
        to={videoPath}
        sx={{
          height: "100%",
          alignItems: "stretch",
          display: variant === "simple" ? "flex" : "block",
          justifyContent: "flex-start",
        }}
      >
        {media}
        <CardContent
          sx={
            variant === "simple"
              ? { minWidth: 0, p: 1.25, "&:last-child": { pb: 1.25 } }
              : undefined
          }
        >
          <Stack direction="row" sx={{ mb: variant === "summary" ? 1 : 0.5 }}>
            <Chip label={video.brand_name} color="primary" size="small" />
          </Stack>
          <Typography
            variant={variant === "summary" ? "h6" : "subtitle2"}
            component="h2"
            sx={{
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: variant === "summary" ? 3 : 2,
            }}
          >
            {video.title}
          </Typography>
          <Typography
            variant={variant === "summary" ? "body2" : "caption"}
            color="text.secondary"
            sx={{ mt: variant === "summary" ? 1 : 0.75, display: "block" }}
          >
            {new Date(video.published_at).toLocaleDateString("zh-TW")}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
