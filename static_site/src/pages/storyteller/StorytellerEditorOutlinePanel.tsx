import BookmarkIcon from "@mui/icons-material/Bookmark";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import TitleIcon from "@mui/icons-material/Title";
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
import { useEditorState } from "@tiptap/react";
import { useMemo, useState } from "react";

import type { StorytellerWritingBookmark } from "@/types/storyteller.ts";
import { extractDocumentMarkers } from "@/pages/storyteller/wysiwygCore/extractHeadingOutline.ts";
import { jumpToMarker } from "@/pages/storyteller/wysiwygCore/jumpToMarker.ts";

const PREVIEW_CHARS = 24;

interface OutlineListItem {
  key: string;
  kind: "heading" | "bookmark";
  markerId: string;
  pos: number | null;
  text: string;
  level?: number;
  note?: string | null;
  missing?: boolean;
}

function previewText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "（空白段落）";
  return trimmed.length > PREVIEW_CHARS
    ? `${trimmed.slice(0, PREVIEW_CHARS)}…`
    : trimmed;
}

function mergeOutlineItems(
  headings: ReturnType<typeof extractDocumentMarkers>["headings"],
  paragraphs: ReturnType<typeof extractDocumentMarkers>["paragraphs"],
  bookmarks: StorytellerWritingBookmark[],
): OutlineListItem[] {
  const items: OutlineListItem[] = headings.map((heading) => ({
    key: `heading-${heading.markerId}`,
    kind: "heading",
    markerId: heading.markerId,
    pos: heading.pos,
    text: heading.text || "（無標題文字）",
    level: heading.level,
  }));

  for (const bookmark of bookmarks) {
    const paragraph = paragraphs.get(bookmark.marker_id);
    items.push({
      key: `bookmark-${bookmark.id}`,
      kind: "bookmark",
      markerId: bookmark.marker_id,
      pos: paragraph?.pos ?? null,
      text: bookmark.note?.trim()
        ? bookmark.note.trim()
        : previewText(paragraph?.text ?? ""),
      note: bookmark.note,
      missing: !paragraph,
    });
  }

  items.sort((a, b) => {
    if (a.pos === null && b.pos === null) return a.key.localeCompare(b.key);
    if (a.pos === null) return 1;
    if (b.pos === null) return -1;
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.kind === b.kind) return 0;
    return a.kind === "heading" ? -1 : 1;
  });
  return items;
}

interface StorytellerEditorOutlinePanelProps {
  editor: Editor | null;
  bookmarks: StorytellerWritingBookmark[];
  loading?: boolean;
  onDeleteBookmark: (markerId: string) => void;
  onUpdateBookmarkNote: (markerId: string, note: string) => void;
}

// 左側 dock 內容：標題 + 書籤依文件 pos 合併成同一份清單。
export function StorytellerEditorOutlinePanel({
  editor,
  bookmarks,
  loading,
  onDeleteBookmark,
  onUpdateBookmarkNote,
}: StorytellerEditorOutlinePanelProps) {
  const markers = useEditorState({
    editor,
    selector: (ctx) =>
      ctx.editor
        ? extractDocumentMarkers(ctx.editor.state.doc)
        : { headings: [], paragraphs: new Map() },
  });
  const items = useMemo(
    () =>
      mergeOutlineItems(
        markers?.headings ?? [],
        markers?.paragraphs ?? new Map(),
        bookmarks,
      ),
    [markers, bookmarks],
  );
  const [editing, setEditing] = useState<OutlineListItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [deleting, setDeleting] = useState<OutlineListItem | null>(null);

  const jump = (item: OutlineListItem) => {
    if (!editor || item.missing || item.pos === null) return;
    jumpToMarker(editor, item.markerId, item.pos);
  };

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
        大綱與書籤
      </Typography>
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          載入書籤中…
        </Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          還沒有標題或書籤。把段落設成標題，或在段落上加入書籤，就會出現在這裡。
        </Typography>
      ) : (
        <List dense disablePadding>
          {items.map((item) =>
            item.kind === "heading" ? (
              <ListItemButton
                key={item.key}
                onClick={() => jump(item)}
                sx={{ pl: 1 + ((item.level ?? 1) - 1) * 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TitleIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    variant: item.level === 1 ? "body1" : "body2",
                    fontWeight: item.level === 1 ? 700 : 500,
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            ) : (
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
                      item.missing ? 0.04 : 0.08,
                    ),
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <BookmarkIcon
                    fontSize="small"
                    color={item.missing ? "disabled" : "warning"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    item.missing ? "找不到這個位置了，可能已被刪除" : item.text
                  }
                  primaryTypographyProps={{
                    variant: "body2",
                    color: item.missing ? "text.secondary" : "text.primary",
                    noWrap: !item.missing,
                  }}
                />
                <Stack
                  direction="row"
                  spacing={0}
                  onClick={(event) => event.stopPropagation()}
                >
                  {!item.missing && (
                    <Tooltip title="編輯筆記">
                      <IconButton
                        size="small"
                        aria-label="編輯筆記"
                        onClick={() => openEdit(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="刪除書籤">
                    <IconButton
                      size="small"
                      aria-label="刪除書籤"
                      onClick={() => setDeleting(item)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </ListItemButton>
            ),
          )}
        </List>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>編輯書籤筆記</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            label="筆記（可留空）"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button variant="contained" onClick={confirmEdit}>
            儲存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>刪除書籤</DialogTitle>
        <DialogContent>
          <Typography>確定要刪除這筆書籤嗎？此操作無法復原。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (!deleting) return;
              onDeleteBookmark(deleting.markerId);
              setDeleting(null);
            }}
          >
            刪除
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
