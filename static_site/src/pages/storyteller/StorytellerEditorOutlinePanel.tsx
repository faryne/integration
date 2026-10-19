import BookmarkIcon from "@mui/icons-material/Bookmark";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CropFreeIcon from "@mui/icons-material/CropFree";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Editor } from "@tiptap/core";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";

import type { StorytellerWritingBookmark } from "@/types/storyteller.ts";
import { documentOutline } from "@/pages/storyteller/documentEditor/documentSections.ts";
import type { DocumentScope } from "@/pages/storyteller/documentEditor/useDocumentScope.ts";
import {
  findParagraphPosByMarkerId,
  jumpToMarker,
} from "@/pages/storyteller/wysiwygCore/jumpToMarker.ts";

const PREVIEW_CHARS = 24;

interface OutlineListItem {
  key: string;
  kind: "heading" | "bookmark";
  markerId: string;
  // 在全文的第幾行；書籤找不到段落（被刪了）時是 null
  line: number | null;
  text: string;
  level?: number;
  note?: string | null;
  missing?: boolean;
}

function previewText(text: string, emptyParagraph: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return emptyParagraph;
  return trimmed.length > PREVIEW_CHARS
    ? `${trimmed.slice(0, PREVIEW_CHARS)}…`
    : trimmed;
}

function mergeOutlineItems(
  outline: ReturnType<typeof documentOutline>,
  bookmarks: StorytellerWritingBookmark[],
  emptyParagraph: string,
  untitled: string,
): OutlineListItem[] {
  const items: OutlineListItem[] = outline.sections.map((section) => ({
    key: `heading-${section.markerId}`,
    kind: "heading",
    markerId: section.markerId,
    line: section.start,
    text: section.title || untitled,
    level: section.level,
  }));
  for (const bookmark of bookmarks) {
    const paragraph = outline.paragraphs.get(bookmark.marker_id);
    items.push({
      key: `bookmark-${bookmark.id}`,
      kind: "bookmark",
      markerId: bookmark.marker_id,
      line: paragraph?.line ?? null,
      text: bookmark.note?.trim()
        ? bookmark.note.trim()
        : previewText(paragraph?.text ?? "", emptyParagraph),
      note: bookmark.note,
      missing: !paragraph,
    });
  }
  items.sort((a, b) => {
    if (a.line === null && b.line === null) return a.key.localeCompare(b.key);
    if (a.line === null) return 1;
    if (b.line === null) return -1;
    if (a.line !== b.line) return a.line - b.line;
    if (a.kind === b.kind) return 0;
    return a.kind === "heading" ? -1 : 1;
  });
  return items;
}

interface StorytellerEditorOutlinePanelProps {
  editor: Editor | null;
  // 全文（草稿）。大綱永遠列全文的標題與書籤，只編輯某一章時範圍外的變灰
  content: string;
  // 目前只編輯的範圍；null＝全文
  scope: DocumentScope | null;
  bookmarks: StorytellerWritingBookmark[];
  loading?: boolean;
  onDeleteBookmark: (markerId: string) => void;
  onUpdateBookmarkNote: (markerId: string, note: string) => void;
  // 標題右側的「只編輯這段」
  onEditSection: (markerId: string) => void;
  onBackToFull: () => void;
  // 點範圍外的標題或書籤：回到全文再跳過去
  onJumpOutside: (markerId: string) => void;
}

// 大綱面板內容：全文的標題＋書籤依行號合併成同一份清單，也是「只編輯某一章」的入口。
// 外層容器（Popper）由 StorytellerEditorOutlineToggle 負責，這裡不管怎麼掛到畫面上。
export function StorytellerEditorOutlinePanel({
  editor,
  content,
  scope,
  bookmarks,
  loading,
  onDeleteBookmark,
  onUpdateBookmarkNote,
  onEditSection,
  onBackToFull,
  onJumpOutside,
}: StorytellerEditorOutlinePanelProps) {
  const { t } = useTranslation();
  // 面板開著時每次打字都會重新解析全文，延後到閒置時再算，不拖慢打字
  const deferredContent = useDeferredValue(content);
  const items = useMemo(
    () => mergeOutlineItems(
      documentOutline(deferredContent),
      bookmarks,
      t("writer:editor.outline.emptyParagraph"),
      t("writer:editor.outline.untitled"),
    ),
    [deferredContent, bookmarks, t],
  );
  const [editing, setEditing] = useState<OutlineListItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [deleting, setDeleting] = useState<OutlineListItem | null>(null);

  const inScope = (item: OutlineListItem) =>
    !scope ||
    (item.line !== null &&
      item.line >= scope.start &&
      item.line < scope.start + scope.count);
  const jump = (item: OutlineListItem) => {
    if (item.missing) return;
    if (!inScope(item)) return onJumpOutside(item.markerId);
    if (!editor) return;
    const pos = findParagraphPosByMarkerId(editor.state.doc, item.markerId);
    if (pos !== null) jumpToMarker(editor, item.markerId, pos);
  };
  // 範圍外的項目：字變淡，右側標「全文」提示點了會回到全文
  const outsideHint = (
    <Typography
      variant="caption"
      color="text.disabled"
      sx={{ flexShrink: 0, mx: 0.5 }}
    >
      {t("writer:editor.outline.fullDocument")}
    </Typography>
  );

  const openEdit = (item: OutlineListItem) => {
    setEditing(item);
    setNoteDraft(item.note ?? "");
  };

  const confirmEdit = () => {
    if (!editing) return;
    onUpdateBookmarkNote(editing.markerId, noteDraft);
    setEditing(null);
  };

  return (
    <Paper
      elevation={6}
      sx={{
        borderRadius: 1,
        p: 2,
        overflow: "auto",
        border: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
        {t("writer:editor.outline.title")}
      </Typography>
      {scope && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{
            mb: 1,
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
            color: "primary.main",
          }}
        >
          <Typography variant="caption" noWrap>
            {t("writer:editor.outline.editingOnly", {
              title: scope.title || t("writer:editor.outline.untitled"),
            })}
          </Typography>
          <Button
            size="small"
            onClick={onBackToFull}
            sx={{ flexShrink: 0, minWidth: 0, py: 0 }}
          >
            {t("writer:editor.outline.backToFull")}
          </Button>
        </Stack>
      )}
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          {t("writer:editor.outline.loading")}
        </Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("writer:editor.outline.empty")}
        </Typography>
      ) : (
        <List dense disablePadding>
          {items.map((item) => {
            const outside = !item.missing && !inScope(item);
            if (item.kind === "heading") {
              const current = scope?.markerId === item.markerId;
              return (
                <ListItemButton
                  key={item.key}
                  selected={current}
                  onClick={() => jump(item)}
                  sx={{ pl: 1 + ((item.level ?? 1) - 1) * 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <ViewHeadlineIcon
                      fontSize="small"
                      color={current ? "primary" : "action"}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      variant: item.level === 1 ? "body1" : "body2",
                      fontWeight: item.level === 1 ? 700 : 500,
                      noWrap: true,
                      color: current
                        ? "primary.main"
                        : outside
                          ? "text.disabled"
                          : "text.primary",
                    }}
                  />
                  {outside && outsideHint}
                  {current ? (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ flexShrink: 0, mx: 0.5 }}
                    >
                      {t("writer:editor.outline.editing")}
                    </Typography>
                  ) : (
                    <Tooltip title={t("writer:editor.outline.editSection")}>
                      <IconButton
                        size="small"
                        aria-label={t("writer:editor.outline.editSection")}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditSection(item.markerId);
                        }}
                      >
                        <CropFreeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              );
            }
            return (
              <ListItemButton
                key={item.key}
                // 不用 disabled——MUI 的 disabled ButtonBase 會把 pointer-events
                // 連同巢狀子元件一起關掉，讓「找不到位置」項目右側的編輯/刪除
                // IconButton 也點不到。跳轉本身已經在 jump() 裡擋掉 item.missing，
                // 這裡只要不讓整排變成 disabled 狀態即可。
                onClick={() => jump(item)}
                sx={{
                  pl: 1,
                  bgcolor: (theme) =>
                    alpha(
                      theme.palette.warning.main,
                      item.missing || outside ? 0.04 : 0.08,
                    ),
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <BookmarkIcon
                    fontSize="small"
                    color={item.missing || outside ? "disabled" : "warning"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    item.missing ? t("writer:editor.outline.missing") : item.text
                  }
                  primaryTypographyProps={{
                    variant: "body2",
                    color: item.missing
                      ? "text.secondary"
                      : outside
                        ? "text.disabled"
                        : "text.primary",
                    noWrap: !item.missing,
                  }}
                />
                {outside && outsideHint}
                <Stack
                  direction="row"
                  spacing={0}
                  onClick={(event) => event.stopPropagation()}
                >
                  {!item.missing && (
                    <Tooltip title={t("writer:editor.outline.editNote")}>
                      <IconButton
                        size="small"
                        aria-label={t("writer:editor.outline.editNote")}
                        onClick={() => openEdit(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t("writer:editor.outline.deleteBookmark")}>
                    <IconButton
                      size="small"
                      aria-label={t("writer:editor.outline.deleteBookmark")}
                      onClick={() => setDeleting(item)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </ListItemButton>
            );
          })}
        </List>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("writer:editor.bookmark.edit")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            label={t("writer:editor.bookmark.note")}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>{t("writer:common.cancel")}</Button>
          <Button variant="contained" onClick={confirmEdit}>
            {t("writer:common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <StorytellerMascotDialog
        open={deleting !== null}
        state="danger"
        eyebrow={t("writer:editor.outline.deleteBookmark")}
        title={t("writer:editor.outline.deleteTitle")}
        description={t("writer:editor.outline.deleteDescription")}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>{t("writer:common.cancel")}</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                if (!deleting) return;
                onDeleteBookmark(deleting.markerId);
                setDeleting(null);
              }}
            >
              {t("writer:common.delete")}
            </Button>
          </>
        }
      />
    </Paper>
  );
}
