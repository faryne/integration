import PersonIcon from "@mui/icons-material/Person";
import { Avatar, Box, Chip, Link, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { steamloomCreatorPath } from "@/helpers/steamloom.ts";
import type { AuthorPostComment } from "@/types/storytellerTimeline.ts";
import type { CommentConfirm, ReplyTarget } from "./CommentBox.tsx";
import { PostMarkerText } from "./PostMarkerText.tsx";
import { postFullTime, postTimeLabel } from "./postTime.ts";

// 一則留言或回覆；已刪除的只留佔位（不顯示名字、時間、內文）
export function CommentItem({
  comment,
  threadId,
  isReply = false,
  canWrite,
  flash,
  onReply,
  onConfirm,
}: {
  comment: AuthorPostComment;
  threadId: string;
  isReply?: boolean;
  canWrite: boolean;
  flash: string;
  onReply: (target: ReplyTarget) => void;
  onConfirm: (confirm: CommentConfirm) => void;
}) {
  const name = comment.author?.pen_name;
  return (
    <Box
      id={`c-${comment.public_id}`}
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: "30px minmax(0, 1fr)",
        gap: 1.25,
        py: 1,
        ml: isReply ? 5 : 0,
        borderRadius: 1,
        scrollMarginTop: 96,
        animation:
          flash === comment.public_id
            ? "commentFlash 2.4s ease-out"
            : undefined,
        "@keyframes commentFlash": {
          from: { backgroundColor: alpha(theme.palette.primary.main, 0.18) },
          to: { backgroundColor: "transparent" },
        },
      })}
    >
      <Avatar
        src={comment.deleted ? undefined : comment.author?.avatar_url}
        sx={{ width: 30, height: 30 }}
      >
        <PersonIcon fontSize="small" />
      </Avatar>
      {comment.deleted ? (
        <Typography
          variant="body2"
          color="text.disabled"
          fontStyle="italic"
          sx={{ alignSelf: "center" }}
        >
          {isReply ? "此回覆已刪除" : "此留言已刪除"}
        </Typography>
      ) : (
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            {name ? (
              <Link
                component={RouterLink}
                to={steamloomCreatorPath(name)}
                fontWeight={800}
                color="inherit"
                underline="hover"
                variant="body2"
              >
                {name}
              </Link>
            ) : (
              <Typography
                variant="body2"
                fontWeight={800}
                color="text.secondary"
              >
                已不存在的使用者
              </Typography>
            )}
            {comment.is_post_author && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label="作者"
                sx={{ height: 18 }}
              />
            )}
            {comment.blocked && (
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label="已封鎖"
                sx={{ height: 18 }}
              />
            )}
            {comment.created_at && (
              <Typography
                variant="caption"
                color="text.disabled"
                title={postFullTime(comment.created_at)}
              >
                · {postTimeLabel(comment.created_at)}
              </Typography>
            )}
          </Stack>
          {comment.reply_to && (
            <Typography variant="caption" color="text.secondary">
              ↪ 回覆{" "}
              {comment.reply_to.deleted ? (
                "已刪除的留言"
              ) : (
                <b>@{comment.reply_to.pen_name}</b>
              )}
            </Typography>
          )}
          <PostMarkerText body={comment.body ?? ""} fontSize={14} />
          <Stack direction="row" spacing={1.5}>
            {canWrite && (
              <CommentAction
                label="回覆"
                onClick={() =>
                  onReply({
                    thread: threadId,
                    to:
                      isReply && name
                        ? { publicId: comment.public_id, penName: name }
                        : undefined,
                  })
                }
              />
            )}
            {comment.can_delete && (
              <CommentAction
                label="刪除"
                danger
                onClick={() => onConfirm({ type: "delete", comment })}
              />
            )}
            {comment.can_block && (
              <CommentAction
                label="封鎖"
                danger
                onClick={() => onConfirm({ type: "block", comment })}
              />
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function CommentAction({
  label,
  danger = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Typography
      component="button"
      variant="caption"
      onClick={onClick}
      sx={{
        border: 0,
        p: 0,
        bgcolor: "transparent",
        color: "text.secondary",
        fontWeight: 700,
        cursor: "pointer",
        "&:hover": { color: danger ? "error.main" : "text.primary" },
      }}
    >
      {label}
    </Typography>
  );
}
