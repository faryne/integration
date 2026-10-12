import { stripMarkerForDiffLine } from "@steamloom-web/pages/storyteller/wysiwygCore/parser.ts";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { backend, type DocumentItem } from "@/lib/backend.ts";
import { dateTimeFormat } from "@/lib/format.ts";
import { useBackendData } from "@/lib/useBackendData.ts";

// 編輯分頁：版面比照網站編輯區（標題、狀態列、摘要、內文）。
// 目前唯讀，內文逐行顯示（用網站的 stripMarkerForDiffLine 拿掉段落／行內 marker）；之後換成網站的 WYSIWYG 編輯器。
export function EditorPanel({ project, item }: { project: string; item: DocumentItem }) {
  const { t } = useTranslation();
  const doc = useBackendData(() => backend.Document(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  if (doc === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  if (!doc) return null;
  // 圖像作品的內容是 JSON，不能當文字顯示
  const paragraphs =
    doc.content_type === "image"
      ? []
      : (doc.latest_content ?? "")
          .split("\n")
          .map(stripMarkerForDiffLine)
          .filter((line) => line.trim());
  return (
    <Box sx={{ flex: 1, overflow: "auto" }}>
      <Box component="article" sx={{ maxWidth: 860, mx: "auto", px: 5, pt: 3.25, pb: 7.5 }}>
        <Typography variant="h1" sx={{ fontSize: 34, mb: 1.5 }}>
          {doc.title}
        </Typography>
        <Stack direction="row" spacing={2.25} sx={{ color: "text.secondary", fontSize: 12.5, mb: 1.25 }}>
          {doc.status && (
            <span>
              {t("workspace.meta.status")} <b>{t(`workspace.status.${doc.status}`, doc.status)}</b>
            </span>
          )}
          <span>{t("workspace.meta.wordCount", { words: doc.word_count.toLocaleString() })}</span>
          <span>{t("workspace.meta.updatedAt", { date: dateTimeFormat.format(new Date(doc.updated_at)) })}</span>
        </Stack>
        {doc.summary && (
          <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2.75 }}>
            {doc.summary}
          </Typography>
        )}
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2.75 }}>
          {paragraphs.map((line, index) => (
            <Typography key={index} sx={{ fontSize: 16, lineHeight: 2, mb: 1.5 }}>
              {line}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
