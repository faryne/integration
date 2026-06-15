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
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import { useGalgameVideoFavorite } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

export function GalgameVideoCard({
  video,
  favorite = false,
}: {
  video: GalgameVideo;
  favorite?: boolean;
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

  return (
    <Card sx={{ height: "100%", position: "relative" }}>
      <Tooltip title={isFavorite ? "取消收藏影片" : "收藏影片"}>
        <Box
          sx={{
            position: "absolute",
            zIndex: 1,
            top: 8,
            right: 8,
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
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
        to={galgamePath(
          `${galgameBrandSlug(video.brand_public_id, video.brand_name)}/video/${video.youtube_video_id}`,
        )}
        sx={{ height: "100%", alignItems: "stretch" }}
      >
        <CardMedia
          component="img"
          height="180"
          image={video.thumbnail_url}
          alt={video.title}
          sx={{ objectFit: "cover" }}
        />
        <CardContent>
          <Stack direction="row" sx={{ mb: 1 }}>
            <Chip label={video.brand_name} color="primary" size="small" />
          </Stack>
          <Typography variant="h6" component="h2">
            {video.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {new Date(video.published_at).toLocaleDateString("zh-TW")}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
