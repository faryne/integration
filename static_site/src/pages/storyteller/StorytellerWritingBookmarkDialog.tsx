import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface StorytellerWritingBookmarkDialogProps {
  open: boolean;
  /** create：加入新書籤；edit：調整既有書籤的筆記，多一個「移除書籤」的次要動作。 */
  mode: "create" | "edit";
  snippet: string;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** 只有 mode 是 edit 時才會顯示「移除書籤」按鈕。 */
  onRemove?: () => void;
}

// 加入書籤時可選填筆記，沒填也只是標記這個位置；已存在的書籤點擊後會用同一個
// dialog 進入編輯模式調整筆記，移除書籤則交給既有的移除確認流程處理。
export function StorytellerWritingBookmarkDialog({
  open,
  mode,
  snippet,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  onRemove,
}: StorytellerWritingBookmarkDialogProps) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(isEdit ? "writer:editor.bookmark.edit" : "writer:editor.bookmark.add")}</DialogTitle>
      <DialogContent>
        {snippet && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("writer:editor.bookmark.attached", { text: snippet })}
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label={t("writer:editor.bookmark.note")}
          placeholder={t("writer:editor.bookmark.placeholder")}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        {isEdit && onRemove && (
          <Button color="error" onClick={onRemove} sx={{ marginRight: "auto" }}>
            {t("writer:editor.bookmark.remove")}
          </Button>
        )}
        <Button onClick={onClose}>{t("writer:common.cancel")}</Button>
        <Button variant="contained" onClick={onConfirm}>
          {t(isEdit ? "writer:common.save" : "writer:editor.bookmark.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
