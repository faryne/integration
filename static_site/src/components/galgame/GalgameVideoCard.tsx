import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { GalgameVideo } from "@/types/galgame.ts";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";

export function GalgameVideoCard({ video }: { video: GalgameVideo }) {
  return (
    <Card sx={{ height: "100%" }}>
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
