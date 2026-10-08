import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuthorPost, useTimelineAction } from "@/apis/storyteller.ts";
import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { CommentBox } from "@/components/storyteller/timeline/CommentBox.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { steamloomPostPath, steamloomPostsPath } from "@/helpers/steamloom.ts";
import type { StorytellerNotification } from "@/types/storytellerNotification.ts";
import { NotificationActorAvatar } from "./StorytellerNotificationFollow.tsx";
import { notificationActorName } from "./storytellerNotificationUI.ts";

// 作者動態的兩種通知內容頁：追蹤的作者發了新動態（posted）、動態留言／回覆（comment）。
// 摘要都是後端遮蔽過的純文字（劇透／R18 已換成［劇透］／［R18］），這裡不再解析標記。

function Quote({
  label,
  text,
  indent = false,
}: {
  label: string;
  text: string;
  indent?: boolean;
}) {
  return (
    <Box
      sx={{
        ml: indent ? 2 : 0,
        px: 1.5,
        py: 1.25,
        borderLeft: 3,
        borderColor: "divider",
        bgcolor: "action.hover",
        borderRadius: "0 8px 8px 0",
      }}
    >
      <Typography variant="caption" color="text.disabled" component="p">
        {label}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ overflowWrap: "anywhere" }}
      >
        {text}
      </Typography>
    </Box>
  );
}

export function PostedNotificationBody({ n }: { n: StorytellerNotification }) {
  const author = n.payload.post_author ?? n.payload.actor?.pen_name;
  if (n.payload.deleted || !author) {
    return <Alert severity="info">這些動態已經刪除。</Alert>;
  }
  return (
    <Stack spacing={1.5}>
      {(n.payload.posts ?? []).map((post) => (
        <Box
          key={post.public_id}
          component={RouterLink}
          to={steamloomPostPath(author, post.public_id)}
          sx={{
            p: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 1.25,
            color: "inherit",
            textDecoration: "none",
            overflowWrap: "anywhere",
            "&:hover": { borderColor: "primary.main" },
          }}
        >
          <Typography variant="body2">{post.excerpt}</Typography>
          {post.work && (
            <Typography variant="caption" color="text.secondary">
              附上 {post.work}
            </Typography>
          )}
        </Box>
      ))}
      <Box>
        <Button
          variant="outlined"
          component={RouterLink}
          to={steamloomPostsPath(author)}
        >
          前往 {author} 的動態
        </Button>
      </Box>
    </Stack>
  );
}

export function CommentNotificationBody({ n }: { n: StorytellerNotification }) {
  const p = n.payload;
  const replied = n.kind === "post.replied";
  return (
    <Stack spacing={1.5}>
      <Quote
        label={`${p.post_author ?? "作者"} 的貼文`}
        text={p.post_excerpt ?? ""}
      />
      {replied && p.parent_excerpt && (
        <Quote label="你的留言" text={p.parent_excerpt} indent />
      )}
      {p.deleted ? (
        <Alert severity="info">這則留言已經刪除。</Alert>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 1.25,
            }}
          >
            <NotificationActorAvatar n={n} size={30} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={800}>
                {notificationActorName(n)}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {p.comment_excerpt}
              </Typography>
            </Box>
          </Stack>
          <QuickReply n={n} />
        </>
      )}
    </Stack>
  );
}

// 從通知直接回覆：用貼文單頁的 comment_state 判斷能不能留言、會用哪個身份（後端決定，前端不傳身份）
function QuickReply({ n }: { n: StorytellerNotification }) {
  const p = n.payload;
  const { data } = useAuthorPost(p.post_public_id);
  const action = useTimelineAction();
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const author = p.post_author ?? data?.post.author.pen_name ?? "";
  const postLink = p.post_public_id
    ? steamloomPostPath(author, p.post_public_id, p.comment_public_id)
    : "";
  const isReply =
    p.thread_public_id && p.thread_public_id !== p.comment_public_id;

  return (
    <Stack spacing={1}>
      {data?.comment_state === "ok" && p.thread_public_id && (
        <CommentBox
          asName={data.comment_as ?? ""}
          target={{
            thread: p.thread_public_id,
            to: isReply
              ? {
                  publicId: p.comment_public_id!,
                  penName: notificationActorName(n),
                }
              : undefined,
          }}
          placeholder={`直接回覆 ${notificationActorName(n)}…`}
          pending={action.isPending}
          onSend={(body, done) =>
            action.mutate(
              {
                type: "comment",
                postId: p.post_public_id!,
                input: {
                  body,
                  parent: p.thread_public_id,
                  reply_to: isReply ? p.comment_public_id : undefined,
                },
              },
              {
                onSuccess: () => {
                  done();
                  setSnack({ message: "已回覆", severity: "success" });
                },
                onError: (error) =>
                  setSnack({
                    message: apiErrorMessage(error, "回覆失敗，請重試。"),
                    severity: "error",
                  }),
              },
            )
          }
        />
      )}
      {postLink && (
        <Box>
          <Button variant="outlined" component={RouterLink} to={postLink}>
            前往貼文
          </Button>
        </Box>
      )}
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </Stack>
  );
}
