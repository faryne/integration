import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import {
  useGalgameBrandFavorite,
  useGalgameVideoFavorite,
  useGalgameVideoReaction,
} from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { FavoriteButton } from "@/components/galgame/FavoriteButton.tsx";
import {
  formatGalgameDuration,
  galgameBrandSlug,
  galgamePath,
} from "@/helpers/galgame.ts";
import type { GalgameVideo } from "@/types/galgame.ts";

// 資訊卡的一列：左邊欄位名、右邊內容
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography
        component="dt"
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: "32px", whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
      <Box
        component="dd"
        sx={{
          m: 0,
          minHeight: 32,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        {children}
      </Box>
    </>
  );
}

/**
 * 影片頁的作品資訊卡：品牌（含收藏品牌）、發佈日・片長、標籤，
 * 底部是收藏影片、在 YouTube 觀看；讚／倒讚縮成右側小圖示，不當主角。
 */
export function VideoInfoCard({
  video,
  brandSlug,
  videoId,
}: {
  video: GalgameVideo;
  brandSlug?: string;
  videoId?: string;
}) {
  const { t, i18n } = useTranslation();
  const { session, login, submitting } = useAuth();
  const videoBrandSlug = galgameBrandSlug(
    video.brand_public_id,
    video.brand_name,
  );
  const brandFavorite = useGalgameBrandFavorite(videoBrandSlug);
  const favorite = useGalgameVideoFavorite(brandSlug, videoId);
  const reaction = useGalgameVideoReaction(brandSlug, videoId);
  const duration = formatGalgameDuration(video.duration_seconds);
  const tags = (video.tags ?? [])
    .map((tag) => tag.replace(/^#+/, "").trim())
    .filter(Boolean);

  // 讚／倒讚互斥：已按其中一個時另一個停用，要先取消才能換邊
  const react = (action: "like" | "dislike") => {
    if (!session) {
      void login();
      return;
    }
    void reaction.mutation.mutateAsync(
      reaction.reaction === action ? `cancel_${action}` : action,
    );
  };
  const reactions = [
    {
      action: "like" as const,
      icon: <ThumbUpOutlinedIcon fontSize="small" />,
      count: reaction.likes ?? video.likes,
    },
    {
      action: "dislike" as const,
      icon: <ThumbDownOutlinedIcon fontSize="small" />,
      count: reaction.dislikes ?? video.dislikes,
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 2,
          rowGap: 1,
          alignItems: "start",
        }}
      >
        <InfoRow label={t("galgame.video.info.brand")}>
          <Link
            component={RouterLink}
            to={galgamePath(videoBrandSlug)}
            underline="hover"
            fontWeight={700}
            sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
          >
            <Avatar
              src={video.brand_avatar_url}
              alt=""
              sx={{ width: 28, height: 28 }}
            />
            {video.brand_name}
          </Link>
          <FavoriteButton
            kind="brand"
            variant="button"
            size="small"
            favorite={brandFavorite.favorite}
            loading={
              brandFavorite.isFetching || brandFavorite.mutation.isPending
            }
            onToggle={(value) => brandFavorite.mutation.mutateAsync(value)}
          />
        </InfoRow>
        <InfoRow label={t("galgame.video.info.published")}>
          <Typography variant="body2">
            {new Date(video.published_at).toLocaleDateString(i18n.language)}
            {duration && ` · ${duration}`}
          </Typography>
        </InfoRow>
        {tags.length > 0 && (
          <InfoRow label={t("galgame.video.info.tags")}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                component={RouterLink}
                clickable
                to={`${galgamePath()}?keyword=${encodeURIComponent(tag)}`}
              />
            ))}
          </InfoRow>
        )}
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
      >
        <FavoriteButton
          kind="video"
          variant="button"
          size="small"
          favorite={favorite.favorite}
          loading={favorite.isFetching || favorite.mutation.isPending}
          onToggle={(value) => favorite.mutation.mutateAsync(value)}
        />
        <Button
          component="a"
          href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="small"
          endIcon={<OpenInNewIcon />}
        >
          {t("galgame.video.watchOnYouTube")}
        </Button>
        <Stack direction="row" alignItems="center" sx={{ ml: "auto" }}>
          {reactions.map((item) => {
            const label = t(`galgame.video.${item.action}`, {
              count: item.count,
            });
            const other = item.action === "like" ? "dislike" : "like";
            return (
              <Tooltip key={item.action} title={label}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={label}
                    aria-pressed={reaction.reaction === item.action}
                    color={
                      reaction.reaction === item.action ? "primary" : "default"
                    }
                    disabled={
                      submitting ||
                      reaction.reaction === other ||
                      reaction.mutation.isPending
                    }
                    onClick={() => react(item.action)}
                    sx={{ borderRadius: 999, gap: 0.5, px: 1 }}
                  >
                    {item.icon}
                    <Typography variant="caption" color="text.secondary">
                      {item.count}
                    </Typography>
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}
