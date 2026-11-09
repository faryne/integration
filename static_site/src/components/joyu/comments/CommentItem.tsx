import { useState } from "react";
import { Box, Button, Menu, MenuItem, Stack, Typography } from "@mui/material";

import {
  useReportComment,
  type JoyuComment,
  type ReportReason,
} from "@/apis/av/joyu_comments.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { relativeTime } from "@/helpers/relativeTime.ts";

import { useJoyuAuth } from "../auth/JoyuAuthContext.ts";
import { CommentMarkdown } from "./CommentMarkdown.tsx";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "垃圾訊息" },
  { value: "harass", label: "騷擾" },
  { value: "privacy", label: "個資" },
  { value: "other", label: "其他" },
];

const KIND_LABELS = { anonymous: "匿名", google: "Google" } as const;

/** 一則留言：名字＋帳號類型小標＋時間、內容（被管理員刪除的留佔位）、回覆與檢舉 */
export function CommentItem({
  comment,
  onReply,
}: {
  comment: JoyuComment;
  onReply: () => void;
}) {
  const { ensureUser } = useJoyuAuth();
  const report = useReportComment();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const kind = comment.author.kind;

  const doReport = async (reason: ReportReason) => {
    setAnchor(null);
    try {
      await ensureUser();
      await report.mutateAsync({ id: comment.id, reason });
      setMessage({ text: "已收到檢舉", ok: true });
    } catch (err) {
      setMessage({
        text: apiErrorMessage(err, "檢舉失敗，請稍後再試"),
        ok: false,
      });
    }
  };

  return (
    <Box id={`comment-${comment.id}`} sx={{ py: 1 }}>
      <Stack direction="row" gap={1} sx={{ alignItems: "center" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          {comment.author.name}
        </Typography>
        {kind && kind !== "deleted" && (
          <Box
            component="span"
            sx={{
              border: "1px solid",
              borderColor: kind === "google" ? "info.main" : "divider",
              borderRadius: 0.5,
              color: kind === "google" ? "info.main" : "text.secondary",
              fontSize: 10,
              px: 0.5,
            }}
          >
            {KIND_LABELS[kind]}
          </Box>
        )}
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {relativeTime(comment.created_at)}
        </Typography>
        {!comment.deleted && (
          <Stack direction="row" sx={{ ml: "auto" }}>
            <Button
              color="inherit"
              onClick={onReply}
              size="small"
              sx={{ minWidth: 0, fontSize: 12 }}
            >
              回覆
            </Button>
            <Button
              color="inherit"
              onClick={(e) => setAnchor(e.currentTarget)}
              size="small"
              sx={{ color: "text.secondary", minWidth: 0, fontSize: 12 }}
            >
              檢舉
            </Button>
          </Stack>
        )}
      </Stack>
      {comment.deleted ? (
        <Typography
          color="text.secondary"
          sx={{ fontSize: 14, fontStyle: "italic", my: 0.5 }}
        >
          此留言已被管理員刪除
        </Typography>
      ) : (
        <CommentMarkdown>
          {comment.reply_to
            ? `@${comment.reply_to.name} ${comment.body}`
            : comment.body}
        </CommentMarkdown>
      )}
      <Menu anchorEl={anchor} onClose={() => setAnchor(null)} open={!!anchor}>
        {REPORT_REASONS.map((r) => (
          <MenuItem key={r.value} onClick={() => void doReport(r.value)}>
            {r.label}
          </MenuItem>
        ))}
      </Menu>
      <CustomSnackbar
        message={message?.text ?? ""}
        onClose={() => setMessage(undefined)}
        open={!!message}
        severity={message?.ok ? "success" : "error"}
      />
    </Box>
  );
}
