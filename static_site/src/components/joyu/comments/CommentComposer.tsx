import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";

import { useJoyuProfile, usePostComment } from "@/apis/av/joyu_comments.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { loadRecaptcha } from "@/lib/recaptcha.ts";

import { useJoyuAuth } from "../auth/JoyuAuthContext.ts";

/**
 * 留言輸入框（頂層與回覆共用）：沒登入時送出才建立匿名帳號；匿名帳號送出時帶 reCAPTCHA token。
 * 回覆別人的回覆時 replyTo 帶那則的 id，後端會掛到同一則頂層留言下並記下 @對象
 */
export function CommentComposer({
  target,
  replyTo,
  autoFocus,
  onDone,
  onPosted,
}: {
  target: string;
  replyTo?: number;
  autoFocus?: boolean;
  // 有給時多一顆「取消」，送出成功或取消都會呼叫（回覆框用來收起）
  onDone?: () => void;
  // 送出成功後呼叫（頂層輸入框用來跳回第一頁，看得到剛留的言）
  onPosted?: () => void;
}) {
  const { user, ensureUser } = useJoyuAuth();
  const profile = useJoyuProfile(user?.uid).data;
  const post = usePostComment(target);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  // 越早載入 reCAPTCHA，風險分數依據的瀏覽行為越完整
  useEffect(() => void loadRecaptcha(), []);

  const submit = async () => {
    if (!body.trim()) return;
    try {
      const u = await ensureUser();
      await post.mutateAsync({
        body,
        replyTo,
        anonymous: u.isAnonymous,
      });
      setBody("");
      onPosted?.();
      onDone?.();
    } catch (err) {
      setError(apiErrorMessage(err, "留言失敗，請稍後再試"));
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <TextField
        autoFocus={autoFocus}
        fullWidth
        minRows={replyTo ? 2 : 3}
        multiline
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          replyTo
            ? "回覆…"
            : "寫點什麼…（支援 Markdown，不支援 HTML、圖片與連結）"
        }
        size="small"
        value={body}
      />
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        sx={{ alignItems: "center", justifyContent: "space-between", mt: 1 }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {profile && (
            <>
              以 <b>{profile.display_name}</b> 身分留言
              {profile.can_edit && (
                <>
                  ・
                  <Box
                    component={RouterLink}
                    sx={{ color: "primary.main" }}
                    to={joyuPath("me/profile")}
                  >
                    改暱稱
                  </Box>
                </>
              )}
            </>
          )}
        </Typography>
        <Stack direction="row" gap={1}>
          {onDone && (
            <Button color="inherit" onClick={onDone} size="small">
              取消
            </Button>
          )}
          <Button
            disabled={!body.trim() || post.isPending}
            onClick={() => void submit()}
            size="small"
            variant="contained"
          >
            送出
          </Button>
        </Stack>
      </Stack>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={!!error}
        severity="error"
      />
    </Box>
  );
}
