import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import EditNoteIcon from "@mui/icons-material/EditNote";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";

// 圖像作品的頁面清單：縮圖格、拖曳排序、刪除、點縮圖編輯「頁面描述」（網站編輯器、不開腳注／註解／資產）。
// 網站 ImageEpisodeEditor 與 SteamLoom Writer 共用；「加入圖片」的方式兩邊不同（網站是拖放區＋<input type=file>，
// Writer 是 Go 的原生選檔視窗），所以由外層用 addControl 傳進來。
export interface ImageEpisodePageView {
  id: string;
  previewUrl: string;
  description: string;
}

export function ImageEpisodePageList({
  pages,
  disabled,
  addControl,
  onPickAsset,
  onMove,
  onRemove,
  onDescriptionChange,
}: {
  pages: ImageEpisodePageView[];
  disabled: boolean;
  addControl: ReactNode;
  onPickAsset: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (pageId: string) => void;
  onDescriptionChange: (pageId: string, description: string) => void;
}) {
  const { t } = useTranslation();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const editingPage = pages.find((page) => page.id === editingPageId) ?? null;
  const editingPageIndex = editingPage ? pages.indexOf(editingPage) : -1;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t("writer:imagePages.title", { count: pages.length })}
      </Typography>
      {addControl}
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<CollectionsIcon />}
          disabled={disabled}
          onClick={onPickAsset}
        >
          {t("writer:imagePages.addFromAssets")}
        </Button>
      </Stack>
      {pages.length > 0 && (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={1.5}
          sx={{ mt: 2 }}
        >
          {pages.map((page, index) => (
            <Paper
              key={page.id}
              variant="outlined"
              draggable
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingIndex !== null && draggingIndex !== index) {
                  onMove(draggingIndex, index);
                }
                setDraggingIndex(null);
              }}
              onClick={() => setEditingPageId(page.id)}
              sx={{
                position: "relative",
                width: 120,
                height: 160,
                overflow: "hidden",
                cursor: "grab",
                opacity: draggingIndex === index ? 0.4 : 1,
              }}
            >
              <Box
                component="img"
                src={page.previewUrl}
                alt={t("writer:imagePages.description", { index: index + 1 })}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  left: 4,
                  bottom: 4,
                  px: 0.5,
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  borderRadius: 0.5,
                }}
              >
                {index + 1}
              </Typography>
              <EditNoteIcon
                fontSize="small"
                sx={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  color: page.description.trim() ? "success.light" : "#fff",
                  bgcolor: "rgba(0,0,0,0.6)",
                  borderRadius: 0.5,
                }}
              />
              <IconButton
                size="small"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(page.id);
                }}
                sx={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </Paper>
          ))}
        </Stack>
      )}
      <Dialog
        open={editingPage !== null}
        onClose={() => setEditingPageId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t("writer:imagePages.description", { index: editingPageIndex + 1 })}
        </DialogTitle>
        <DialogContent>
          {editingPage && (
            <Box sx={{ minHeight: 320, mt: 1 }}>
              <StorytellerWysiwygEditor
                value={editingPage.description}
                onChange={(markdown) =>
                  onDescriptionChange(editingPage.id, markdown)
                }
                enabledFeatures={[]}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPageId(null)}>
            {t("writer:imagePages.done")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
