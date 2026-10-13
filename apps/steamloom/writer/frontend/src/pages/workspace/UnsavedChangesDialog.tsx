import { Button, Dialog, DialogActions, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

// 編輯中的文件還沒存檔就要換文件／離開專案時先問；用 MUI 對話框而不是 window.confirm（WebView 不一定支援）。
export function UnsavedChangesDialog({ open, onDiscard, onCancel }: { open: boolean; onDiscard: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("workspace.editor.unsaved.title")}</DialogTitle>
      <DialogActions>
        <Button onClick={onCancel}>{t("workspace.editor.unsaved.cancel")}</Button>
        <Button color="error" variant="contained" onClick={onDiscard}>
          {t("workspace.editor.unsaved.discard")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
