import DownloadIcon from "@mui/icons-material/Download";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UpdateInfo } from "@writer/lib/backend.ts";

// 偵測到新版時詢問使用者；安裝成功後 Go 端會自動重啟 Writer。
export function UpdateDialog({ info, onLater, onInstall }: { info: UpdateInfo | null; onLater: () => void; onInstall: () => Promise<void> }) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const install = () => {
    setInstalling(true);
    onInstall().catch(() => setInstalling(false));
  };

  return (
    <Dialog open={info !== null} onClose={installing ? undefined : onLater} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <DownloadIcon color="primary" />
          {t("app.update.title")}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("app.update.message", { current: info?.current_version, latest: info?.version })}
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>{t("app.update.restartNotice")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onLater} disabled={installing}>{t("app.update.later")}</Button>
        <Button onClick={install} disabled={installing} variant="contained" startIcon={installing ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {installing ? t("app.update.installing") : t("app.update.install")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
