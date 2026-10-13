import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

// Writer thread 與 provider session 分開刪除；第一版只永久移除本機紀錄。
export function ThreadDeleteDialog({ open, deleting, onClose, onDelete }: { open: boolean; deleting: boolean; onClose: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("workspace.chat.deleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("workspace.chat.deleteDescription")}</DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>{t("workspace.chat.deleteProviderNote")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={deleting} onClick={onClose}>{t("workspace.chat.deleteCancel")}</Button>
        <Button disabled={deleting} color="error" variant="contained" onClick={onDelete}>{t("workspace.chat.deleteConfirm")}</Button>
      </DialogActions>
    </Dialog>
  );
}
