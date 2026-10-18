import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type Project } from "@writer/lib/backend.ts";

// 匯出專案備份：只問要不要含圖像作品的圖片（會比較大、比較慢），按下匯出後由 Go 開存檔對話框並寫 zip。
// 匯出期間鎖住對話框；取消存檔對話框（回傳空字串）不提示。
export function ExportBackupDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const [includeImages, setIncludeImages] = useState(false);
  const [exporting, setExporting] = useState(false);

  const run = async () => {
    setExporting(true);
    try {
      const path = await backend.ExportProjectBackup(project.public_id, includeImages);
      if (!path) return;
      showSuccess(t("projects.backup.done", { path }));
      onClose();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open onClose={() => !exporting && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{t("projects.backup.title", { name: project.name })}</DialogTitle>
      <DialogContent>
        <FormControlLabel control={<Checkbox checked={includeImages} disabled={exporting} onChange={(_, checked) => setIncludeImages(checked)} />} label={t("projects.backup.includeImages")} />
      </DialogContent>
      <DialogActions>
        <Button disabled={exporting} onClick={onClose}>{t("projects.backup.cancel")}</Button>
        <Button variant="contained" disabled={exporting} onClick={() => void run()}>
          {exporting ? <CircularProgress size={16} color="inherit" /> : t("projects.backup.export")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
