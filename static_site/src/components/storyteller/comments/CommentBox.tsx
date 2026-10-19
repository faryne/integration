import {
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  // 身份清單可能比元件晚載入：還沒選過就顯示第一個（後端也是預設用第一個）
  const current = value || options[0] || "";
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      {/* 「以 某筆名 回覆」的語序各語言不同，前後綴分開翻，空字串就不顯示 */}
      {t("web.social.speakAs.prefix", { verb }) && (
        <Typography variant="caption" color="text.secondary">
          {t("web.social.speakAs.prefix", { verb })}
        </Typography>
      )}
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
      {t("web.social.speakAs.suffix", { verb }) && (
        <Typography variant="caption" color="text.secondary">
          {t("web.social.speakAs.suffix", { verb })}
        </Typography>
      )}
    </Stack>
  );
}

// 留言／回覆框；回覆對象是結構化欄位（reply_to），不能手改，只能取消改回「回覆整串」
export function CommentBox({
  asOptions,
  target,
  placeholder,
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
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [as, setAs] = useState(asOptions[0] ?? "");
  const verb = target ? t("web.social.reply") : t("web.social.comment");
  return (
    <Stack spacing={0.75}>
      {target?.to && (
        <Typography variant="caption" color="text.secondary">
          ↪ {t("web.social.reply")} <b>@{target.to.penName}</b>
          <IconButton
            size="small"
            aria-label={t("web.social.replyToThread")}
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
        placeholder={placeholder ?? t("web.social.replyPlaceholder")}
        minRows={2}
        footer={
          <>
            {onCancel && (
              <Button onClick={onCancel}>{t("web.common.cancel")}</Button>
            )}
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
  const { t } = useTranslation();
  const content = locked
    ? { text: `🔒 ${t("web.social.locked")}` }
    : state === "login"
      ? {
          text: t("web.social.gate.login"),
          action: (
            <Button variant="contained" onClick={onLogin}>
              {t("web.layout.login")}
            </Button>
          ),
        }
      : state === "pen_name"
        ? {
            text: t("web.social.gate.penName"),
            action: (
              <Button
                variant="contained"
                component={RouterLink}
                to={steamloomPath("my/profile")}
              >
                {t("web.social.gate.setPenName")}
              </Button>
            ),
          }
        : { text: t("web.social.gate.restricted", { name: ownerName }) };
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
