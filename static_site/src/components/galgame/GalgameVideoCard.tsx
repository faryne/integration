import {
  alpha,
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
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import type { GalgameVideo } from "@/types/galgame.ts";
import {
  formatGalgameDuration,
  galgameBrandSlug,
  galgamePath,
} from "@/helpers/galgame.ts";
import { useGalgameVideoFavorite } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

/**
 * 影片卡。summary：縮圖在上、品牌 chip＋日期＋兩行標題在下（列表用）；
 * simple：縮圖在左的橫式小卡（影片頁側欄用）。
 */
export function GalgameVideoCard({
  video,
  favorite = false,
  variant = "summary",
}: {
  video: GalgameVideo;
  favorite?: boolean;
  variant?: "summary" | "simple";
}) {
  const { t, i18n } = useTranslation();
  const { session, login, submitting } = useAuth();
  const favoriteQuery = useGalgameVideoFavorite(
    galgameBrandSlug(video.brand_public_id, video.brand_name),
    video.youtube_video_id,
    false,
  );
  const isFavorite = favoriteQuery.data?.favorite ?? favorite;
  const favoriteLabel = t(
    isFavorite ? "galgame.videoCard.unfavorite" : "galgame.videoCard.favorite",
  );
  const toggleFavorite = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!session) {
      await login();
      return;
    }
    await favoriteQuery.mutation.mutateAsync(!isFavorite);
  };
  const simple = variant === "simple";
  const duration = formatGalgameDuration(video.duration_seconds);
  const disabled = Boolean(video.deleted_at);
  const videoPath = galgamePath(
    `${galgameBrandSlug(video.brand_public_id, video.brand_name)}/video/${video.youtube_video_id}`,
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        position: "relative",
        opacity: disabled ? 0.58 : 1,
        // 可 hover 的裝置上，未收藏的星星只在滑過卡片時出現，縮圖比較乾淨；觸控裝置一律顯示
        "@media (hover: hover)": {
          "& .galgame-card-favorite:not(.is-favorite)": { opacity: 0 },
          "&:hover .galgame-card-favorite, &:focus-within .galgame-card-favorite":
            { opacity: 1 },
        },
      }}
    >
      <Tooltip title={favoriteLabel}>
        <Box
          className={`galgame-card-favorite${isFavorite ? " is-favorite" : ""}`}
          sx={{
            position: "absolute",
            zIndex: 1,
            top: 6,
            // simple 卡的縮圖在左，星星放在縮圖左上角，避免壓到右側標題
            ...(simple ? { left: 6 } : { right: 6 }),
            display: "grid",
            placeItems: "center",
            width: simple ? 28 : 32,
            height: simple ? 28 : 32,
            borderRadius: "50%",
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
            boxShadow: 1,
            transition: "opacity .15s",
          }}
        >
          <IconButton
            size="small"
            color={isFavorite ? "warning" : "default"}
            aria-label={favoriteLabel}
            disabled={
              submitting ||
              disabled ||
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
        component={disabled ? "button" : RouterLink}
        to={disabled ? undefined : videoPath}
        disabled={disabled}
        sx={{
          height: "100%",
          display: simple ? "flex" : "block",
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        <Box
          sx={{ position: "relative", flexShrink: 0, width: simple ? 150 : 1 }}
        >
          <CardMedia
            component="img"
            image={video.thumbnail_url}
            alt={video.title}
            sx={{ objectFit: "cover", width: 1, aspectRatio: "16 / 9" }}
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
        <CardContent
          sx={{
            minWidth: 0,
            p: simple ? 1.25 : 1.5,
            "&:last-child": { pb: simple ? 1.25 : 1.5 },
            // summary：品牌 chip＋日期在上、標題在下；simple：標題在上、品牌 · 日期在下
            display: "flex",
            flexDirection: simple ? "column-reverse" : "column",
            justifyContent: "flex-end",
            gap: simple ? 0.5 : 0.75,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
          >
            {!simple && (
              <Chip label={video.brand_name} color="primary" size="small" />
            )}
            <Typography variant="caption" color="text.secondary">
              {simple && `${video.brand_name} · `}
              {new Date(video.published_at).toLocaleDateString(i18n.language)}
            </Typography>
            {disabled && (
              <Chip label={t("galgame.videoCard.deleted")} size="small" />
            )}
          </Stack>
          <Typography
            variant={simple ? "body2" : "subtitle1"}
            component="h2"
            fontWeight={700}
            sx={{
              lineHeight: 1.4,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {video.title}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
