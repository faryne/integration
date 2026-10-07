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
  const saveVisibility = useSaveFavoriteAuthorVisibility(author.pen_name);
  const saveFavorite = useSaveStorytellerAuthorFavorite(author.pen_name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hidden = author.hidden ?? false;
  const name = author.pen_name || "未命名作者";

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
            <Tooltip title={hidden ? "設為公開" : "設為隱藏"}>
              <span>
                <IconButton
                  size="small"
                  aria-label={hidden ? "設為公開" : "設為隱藏"}
                  disabled={saveVisibility.isPending}
                  onClick={() =>
                    saveVisibility.mutate(!hidden, {
                      onSuccess: () =>
                        onNotify(
                          hidden
                            ? "追蹤作者已設為公開。"
                            : "追蹤作者已設為隱藏。",
                        ),
                      onError: () =>
                        onNotify("追蹤作者公開狀態更新失敗。", "error"),
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
              label={`以 ${author.as} 追蹤`}
            />
          )}
          <Chip size="small" label={`${author.project_count} 個專案`} />
          <Chip
            size="small"
            variant="outlined"
            icon={<ArticleIcon />}
            label={`${author.story_count} 篇故事`}
          />
          {author.image_story_count > 0 && (
            <Chip
              size="small"
              variant="outlined"
              icon={<CollectionsIcon />}
              label={`${author.image_story_count} 話`}
            />
          )}
          <Chip
            size="small"
            label={`平均 ${author.average_rating.toFixed(1)}（${author.rating_count} 人評分）`}
          />
          <Chip size="small" label={`${author.follower_count} 人追蹤`} />
          {hidden && <Chip size="small" color="warning" label="對外隱藏中" />}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
          {author.pen_name && (
            <Button
              component={RouterLink}
              to={steamloomCreatorPath(author.pen_name)}
              variant="contained"
              sx={{ flex: 1 }}
            >
              查看作者
            </Button>
          )}
          {unfollowAs && (
            <Button
              variant="outlined"
              disabled={saveFavorite.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              取消追蹤
            </Button>
          )}
        </Stack>
      </Stack>
      {unfollowAs && (
        <StorytellerMascotDialog
          open={confirmOpen}
          state="neutral"
          eyebrow="取消追蹤"
          title={`要取消以 ${unfollowAs} 追蹤 ${name} 嗎？`}
          description="之後不會再收到這位作者的更新通知（除非你用其他身份追蹤）。"
          onClose={() => setConfirmOpen(false)}
          actions={
            <>
              <Button onClick={() => setConfirmOpen(false)}>保留</Button>
              <Button
                variant="contained"
                disabled={saveFavorite.isPending}
                onClick={() => {
                  setConfirmOpen(false);
                  saveFavorite.mutate(
                    { as: unfollowAs },
                    {
                      onSuccess: () => onNotify(`已取消以 ${unfollowAs} 追蹤`),
                      onError: () =>
                        onNotify("取消追蹤失敗，請稍後再試。", "error"),
                    },
                  );
                }}
              >
                取消追蹤
              </Button>
            </>
          }
        />
      )}
    </Paper>
  );
}
