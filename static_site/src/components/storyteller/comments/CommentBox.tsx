import {
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { PostTextInput } from "@/components/storyteller/timeline/PostTextInput.tsx";
import { postTextValid } from "@/helpers/postMarkers.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type {
  AuthorPostComment,
  CommentViewerState,
} from "@/types/storytellerTimeline.ts";

// 正在回覆哪一串；to 是在串裡指定回覆的那則（「↪ 回覆 @某人」），回覆頂層留言時沒有
export interface ReplyTarget {
  thread: string;
  to?: { publicId: string; penName: string };
}

export type CommentConfirm =
  | { type: "delete"; comment: AuthorPostComment }
  | { type: "block"; comment: AuthorPostComment };

// 「以 X 留言」：只有一個身份就是文字；作品作者在討論版可以在作品的署名身份間切換
export function SpeakAs({
  options,
  value,
  onChange,
  verb,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  verb: string;
}) {
  // 身份清單可能比元件晚載入：還沒選過就顯示第一個（後端也是預設用第一個）
  const current = value || options[0] || "";
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Typography variant="caption" color="text.secondary">
        以
      </Typography>
      {options.length > 1 ? (
        <Select
          size="small"
          variant="standard"
          value={current}
          onChange={(event) => onChange(event.target.value)}
          sx={{ fontSize: 12, fontWeight: 700 }}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      ) : (
        <Typography variant="caption" fontWeight={700}>
          {current}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {verb}
      </Typography>
    </Stack>
  );
}

// 留言／回覆框；回覆對象是結構化欄位（reply_to），不能手改，只能取消改回「回覆整串」
export function CommentBox({
  asOptions,
  target,
  placeholder = "回覆…",
  maxLength,
  pending,
  onClearTo,
  onCancel,
  onSend,
}: {
  asOptions: string[];
  target?: ReplyTarget;
  placeholder?: string;
  maxLength?: number;
  pending: boolean;
  onClearTo?: () => void;
  onCancel?: () => void;
  onSend: (body: string, as: string, done: () => void) => void;
}) {
  const [body, setBody] = useState("");
  const [as, setAs] = useState(asOptions[0] ?? "");
  const verb = target ? "回覆" : "留言";
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
        maxLength={maxLength}
        placeholder={placeholder}
        minRows={2}
        footer={
          <>
            {onCancel && <Button onClick={onCancel}>取消</Button>}
            <Button
              variant="contained"
              disabled={pending || !postTextValid(body, maxLength)}
              onClick={() => onSend(body, as, () => setBody(""))}
            >
              {verb}
            </Button>
          </>
        }
      />
      <SpeakAs options={asOptions} value={as} onChange={setAs} verb={verb} />
    </Stack>
  );
}

// 不能留言時的提示：未登入、沒設筆名、被作者封鎖、討論串已鎖定
export function CommentGate({
  state,
  ownerName,
  locked = false,
  onLogin,
}: {
  state: CommentViewerState;
  ownerName: string;
  locked?: boolean;
  onLogin: () => void;
}) {
  const content = locked
    ? { text: "🔒 已鎖定" }
    : state === "login"
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
        : { text: `${ownerName} 已限制你在這裡留言。` };
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
      {"action" in content && content.action}
    </Stack>
  );
}
