import { Button, CircularProgress, Dialog, DialogActions, DialogTitle } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// 編輯中的文件還沒存檔就要換文件／離開專案／問 AI 時先問；用 MUI 對話框而不是 window.confirm（WebView 不一定支援）。
// onSave 回傳 false（存檔失敗或版本衝突）時留在對話框外的編輯頁：外層會把對話框關掉，錯誤由編輯器自己提示。
export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: { open: boolean; onSave: () => Promise<void>; onDiscard: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => !saving && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle>{t("workspace.editor.unsaved.title")}</DialogTitle>
      <DialogActions>
        <Button disabled={saving} onClick={onCancel}>{t("workspace.editor.unsaved.cancel")}</Button>
        <Button color="error" disabled={saving} onClick={onDiscard}>
          {t("workspace.editor.unsaved.discard")}
        </Button>
        <Button variant="contained" disabled={saving} onClick={() => void save()}>
          {saving ? <CircularProgress size={16} color="inherit" /> : t("workspace.editor.unsaved.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
