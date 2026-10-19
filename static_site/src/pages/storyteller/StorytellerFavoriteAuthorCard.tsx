import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Avatar,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  useSaveFavoriteAuthorVisibility,
  useSaveStorytellerAuthorFavorite,
} from "@/apis/storyteller.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { steamloomCreatorPath } from "@/helpers/steamloom.ts";
import { AuthorBio } from "@/pages/storyteller/StorytellerAuthorBio.tsx";
import type { StorytellerFavoriteAuthor } from "@/types/storyteller.ts";

type Notify = (message: string, severity?: "success" | "error") => void;

// 追蹤的作家卡片：作者頁「追蹤的作家」、筆名頁「此筆名追蹤的作家」、工作台「我的追蹤」共用。
// - canToggleVisibility：本人身份的追蹤才有公開／隱藏（以筆名做的追蹤本來就不公開）
// - unfollowAs：以哪個筆名做的追蹤；有值才顯示「取消追蹤」（先跳 confirm）
export function StorytellerFavoriteAuthorCard({
  author,
  canToggleVisibility = false,
  unfollowAs,
  onNotify,
}: {
  author: StorytellerFavoriteAuthor;
  canToggleVisibility?: boolean;
  unfollowAs?: string;
  onNotify: Notify;
}) {
  const { t } = useTranslation();
  const saveVisibility = useSaveFavoriteAuthorVisibility(author.pen_name);
  const saveFavorite = useSaveStorytellerAuthorFavorite(author.pen_name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hidden = author.hidden ?? false;
  const name = author.pen_name || t("web.community.unnamedAuthor");

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 1, height: 1, boxSizing: "border-box" }}
    >
      <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Avatar
              src={author.avatar_url}
              alt={name}
              sx={{ width: 32, height: 32 }}
            >
              <PersonIcon fontSize="small" />
            </Avatar>
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {name}
            </Typography>
          </Stack>
          {canToggleVisibility && !author.as && (
            <Tooltip title={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}>
              <span>
                <IconButton
                  size="small"
                  aria-label={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}
                  disabled={saveVisibility.isPending}
                  onClick={() =>
                    saveVisibility.mutate(!hidden, {
                      onSuccess: () =>
                        onNotify(
                          hidden ? t("web.community.madePublic") : t("web.community.madePrivate"),
                        ),
                      onError: () =>
                        onNotify(t("web.community.authorVisibilityFailed"), "error"),
                    })
                  }
                >
                  {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
        {author.bio && <AuthorBio bio={author.bio} />}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {author.as && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={t("web.community.followedAs", { name: author.as })}
            />
          )}
          <Chip size="small" label={t("web.community.projects", { count: author.project_count })} />
          <Chip
            size="small"
            variant="outlined"
            icon={<ArticleIcon />}
            label={t("web.community.stories", { count: author.story_count })}
          />
          {author.image_story_count > 0 && (
            <Chip
              size="small"
              variant="outlined"
              icon={<CollectionsIcon />}
              label={t("web.community.episodes", { count: author.image_story_count })}
            />
          )}
          <Chip
            size="small"
            label={t("web.community.averageRating", { average: author.average_rating.toFixed(1), count: author.rating_count })}
          />
          <Chip size="small" label={t("web.community.followerCount", { count: author.follower_count })} />
          {hidden && <Chip size="small" color="warning" label={t("web.community.hidden")} />}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
          {author.pen_name && (
            <Button
              component={RouterLink}
              to={steamloomCreatorPath(author.pen_name)}
              variant="contained"
              sx={{ flex: 1 }}
            >
              {t("web.community.viewAuthor")}
            </Button>
          )}
          {unfollowAs && (
            <Button
              variant="outlined"
              disabled={saveFavorite.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t("web.community.unfollow")}
            </Button>
          )}
        </Stack>
      </Stack>
      {unfollowAs && (
        <StorytellerMascotDialog
          open={confirmOpen}
          state="neutral"
          eyebrow={t("web.community.unfollow")}
          title={t("web.community.unfollowTitle", { names: unfollowAs, name })}
          description={t("web.community.cardUnfollowDescription")}
          onClose={() => setConfirmOpen(false)}
          actions={
            <>
              <Button onClick={() => setConfirmOpen(false)}>{t("web.community.keep")}</Button>
              <Button
                variant="contained"
                disabled={saveFavorite.isPending}
                onClick={() => {
                  setConfirmOpen(false);
                  saveFavorite.mutate(
                    { as: unfollowAs },
                    {
                      onSuccess: () => onNotify(t("web.community.unfollowedAs", { names: unfollowAs })),
                      onError: () =>
                        onNotify(t("web.community.unfollowFailed"), "error"),
                    },
                  );
                }}
              >
                {t("web.community.unfollow")}
              </Button>
            </>
          }
        />
      )}
    </Paper>
  );
}
