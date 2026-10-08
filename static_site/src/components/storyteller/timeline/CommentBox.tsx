import { Button, IconButton, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { postTextValid } from "@/helpers/postMarkers.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  COMMENT_MAX_LENGTH,
  type AuthorPostComment,
  type AuthorPostDetail,
} from "@/types/storytellerTimeline.ts";
import { PostTextInput } from "./PostTextInput.tsx";

// 正在回覆哪一串；to 是在串裡指定回覆的那則（「↪ 回覆 @某人」），回覆頂層留言時沒有
export interface ReplyTarget {
  thread: string;
  to?: { publicId: string; penName: string };
}

export type CommentConfirm =
  | { type: "delete"; comment: AuthorPostComment }
  | { type: "block"; comment: AuthorPostComment };

// 留言／回覆框；回覆對象是結構化欄位（reply_to），不能手改，只能取消改回「回覆整串」
export function CommentBox({
  asName,
  target,
  placeholder = "回覆…",
  pending,
  onClearTo,
  onCancel,
  onSend,
}: {
  asName: string;
  target?: ReplyTarget;
  placeholder?: string;
  pending: boolean;
  onClearTo?: () => void;
  onCancel?: () => void;
  onSend: (body: string, done: () => void) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <Stack spacing={0.75}>
      {target?.to && (
        <Typography variant="caption" color="text.secondary">
          ↪ 回覆 <b>@{target.to.penName}</b>
          <IconButton
            size="small"
            aria-label="改成回覆整串"
            onClick={onClearTo}
            sx={{ ml: 0.25, p: 0.25, fontSize: 14 }}
          >
            ×
          </IconButton>
        </Typography>
      )}
      <PostTextInput
        value={body}
        onChange={setBody}
        maxLength={COMMENT_MAX_LENGTH}
        placeholder={placeholder}
        minRows={2}
        footer={
          <>
            {onCancel && <Button onClick={onCancel}>取消</Button>}
            <Button
              variant="contained"
              disabled={pending || !postTextValid(body, COMMENT_MAX_LENGTH)}
              onClick={() => onSend(body, () => setBody(""))}
            >
              {target ? "回覆" : "留言"}
            </Button>
          </>
        }
      />
      <Typography variant="caption" color="text.secondary">
        以 <b>{asName}</b> {target ? "回覆" : "留言"}
      </Typography>
    </Stack>
  );
}

export // 不能留言時的提示：未登入、沒設筆名、被作者封鎖
function CommentGate({
  state,
  postAuthor,
  onLogin,
}: {
  state: AuthorPostDetail["comment_state"];
  postAuthor: string;
  onLogin: () => void;
}) {
  const content =
    state === "login"
      ? {
          text: "登入後才能留言。",
          action: (
            <Button variant="contained" onClick={onLogin}>
              登入
            </Button>
          ),
        }
      : state === "pen_name"
        ? {
            text: "留言前要先設定筆名，其他人會看到這個名字。",
            action: (
              <Button
                variant="contained"
                component={RouterLink}
                to={steamloomPath("my/profile")}
              >
                設定筆名
              </Button>
            ),
          }
        : {
            text: `${postAuthor} 已限制你在這裡留言。你還是可以看動態和作品。`,
          };
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      useFlexGap
    >
      <Typography variant="body2" color="text.secondary">
        {content.text}
      </Typography>
      {content.action}
    </Stack>
  );
}
