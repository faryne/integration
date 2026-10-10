import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PersonIcon from "@mui/icons-material/Person";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useTimelineAction } from "@/apis/storyteller.ts";
import { useOpenReport } from "@/components/storyteller/report/reportContext.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { steamloomPostPath, steamloomPostsPath } from "@/helpers/steamloom.ts";
import type { AuthorPost } from "@/types/storytellerTimeline.ts";
import { PostAttachmentCard } from "./PostAttachmentCard.tsx";
import { PostMarkerText } from "./PostMarkerText.tsx";
import { postFullTime, postTimeLabel } from "./postTime.ts";

type Notify = (message: string, severity?: "success" | "error") => void;

// 一則動態：時間軸（整張可點、進貼文頁）與貼文單頁（detail，不可點、字大一點）共用。
export function AuthorPostCard({
  post,
  detail = false,
  onNotify,
  onLoginRequired,
}: {
  post: AuthorPost;
  detail?: boolean;
  onNotify: Notify;
  onLoginRequired?: () => void;
}) {
  const navigate = useNavigate();
  const action = useTimelineAction();
  const openReport = useOpenReport();
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const penName = post.author.pen_name;
  const postPath = steamloomPostPath(penName, post.public_id);
  const run = (
    payload: Parameters<typeof action.mutate>[0],
    success?: string,
    onDone?: () => void,
  ) =>
    action.mutate(payload, {
      onSuccess: () => {
        if (success) onNotify(success);
        onDone?.();
      },
      onError: (error) =>
        onNotify(apiErrorMessage(error, "操作失敗，請重試。"), "error"),
    });

  return (
    <Box
      component="article"
      onClick={detail ? undefined : () => navigate(postPath)}
      sx={{
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr)",
        gap: 1.5,
        px: 2,
        pt: 1.75,
        pb: 1,
        cursor: detail ? "default" : "pointer",
        "&:hover": detail ? undefined : { bgcolor: "action.hover" },
      }}
    >
      <Avatar src={post.author.avatar_url} alt={penName}>
        <PersonIcon />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="baseline"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography fontWeight={800}>{penName}</Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            title={postFullTime(post.created_at)}
          >
            · {postTimeLabel(post.created_at)}
          </Typography>
          {post.pinned && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              icon={<PushPinOutlinedIcon />}
              label="置頂"
              sx={{ height: 20 }}
            />
          )}
        </Stack>
        <Box sx={{ mt: 0.5 }}>
          <PostMarkerText body={post.body} fontSize={detail ? 16 : 15} />
        </Box>
        {post.attachment && <PostAttachmentCard attachment={post.attachment} />}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 0.75, color: "text.secondary" }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="small"
            color={post.liked_by_me ? "error" : "inherit"}
            startIcon={
              post.liked_by_me ? <FavoriteIcon /> : <FavoriteBorderIcon />
            }
            aria-label={post.liked_by_me ? "取消喜歡" : "喜歡"}
            disabled={action.isPending}
            onClick={() =>
              onLoginRequired
                ? onLoginRequired()
                : run({
                    type: "like",
                    postId: post.public_id,
                    liked: !post.liked_by_me,
                  })
            }
          >
            {post.like_count}
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<ChatBubbleOutlineIcon />}
            aria-label="留言"
            onClick={() => navigate(postPath)}
          >
            {post.comment_count}
          </Button>
          <Box sx={{ flex: 1 }} />
          <IconButton
            size="small"
            aria-label="更多動作"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(event) => event.stopPropagation()}
      >
        {post.is_owner && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              run(
                { type: "pin", postId: post.public_id, pinned: !post.pinned },
                post.pinned ? "已取消置頂" : "已置頂，原本的置頂已取消",
              );
            }}
          >
            {post.pinned ? "取消置頂" : "📌 置頂"}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            void navigator.clipboard
              .writeText(new URL(postPath, window.location.origin).toString())
              .then(() => onNotify("已複製貼文連結"))
              .catch(() => onNotify("複製失敗，請手動複製網址列。", "error"));
          }}
        >
          🔗 複製連結
        </MenuItem>
        {!post.is_owner && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setMenuAnchor(null);
              openReport({
                type: "author_post",
                publicId: post.public_id,
                name: penName,
              });
            }}
          >
            🚩 {t("moderation.report.menu.action")}
          </MenuItem>
        )}
        {post.is_owner && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setMenuAnchor(null);
              setConfirmDelete(true);
            }}
          >
            🗑 刪除
          </MenuItem>
        )}
      </Menu>
      <Box component="span" onClick={(event) => event.stopPropagation()}>
        <StorytellerMascotDialog
          open={confirmDelete}
          state="danger"
          eyebrow="刪除動態"
          title="要刪除這則動態嗎？"
          description={
            post.comment_count > 0
              ? `刪除後無法復原，底下 ${post.comment_count} 則留言也會一起看不到。動態不能編輯，想改內容只能刪掉重發。`
              : "刪除後無法復原。"
          }
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <Button onClick={() => setConfirmDelete(false)}>保留</Button>
              <Button
                color="error"
                variant="contained"
                disabled={action.isPending}
                onClick={() =>
                  run(
                    { type: "delete-post", postId: post.public_id },
                    "已刪除動態",
                    () => {
                      setConfirmDelete(false);
                      if (detail) navigate(steamloomPostsPath(penName));
                    },
                  )
                }
              >
                刪除
              </Button>
            </>
          }
        />
      </Box>
    </Box>
  );
}
