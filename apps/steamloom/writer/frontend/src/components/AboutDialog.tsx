import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Button, Chip, CircularProgress, Dialog, DialogContent, Divider, IconButton, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import appIcon from "@/assets/appicon.png";

type Props = {
  open: boolean;
  version: string;
  onClose: () => void;
  onCheckForUpdate: () => Promise<boolean>;
};

// About 採橫式資訊：左側維持品牌辨識，右側集中版號與手動更新操作。
export function AboutDialog({ open, version, onClose, onCheckForUpdate }: Props) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);

  useEffect(() => {
    if (!open) setUpToDate(false);
  }, [open]);

  const check = () => {
    setChecking(true);
    setUpToDate(false);
    onCheckForUpdate()
      .then((found) => {
        if (found) onClose();
        else setUpToDate(true);
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  };

  return (
    <Dialog open={open} onClose={checking ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ position: "relative", p: { xs: 3, sm: 4 } }}>
        <IconButton aria-label={t("app.about.close")} onClick={onClose} disabled={checking} sx={{ position: "absolute", top: 12, right: 12 }}>
          <CloseIcon />
        </IconButton>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "128px minmax(0, 1fr)" }, gap: { xs: 2.5, sm: 4 }, alignItems: "center" }}>
          <Box
            component="img"
            src={appIcon}
            alt="SteamLoom Writer"
            sx={{ width: 128, height: 128, borderRadius: "26%", justifySelf: { xs: "center", sm: "start" }, boxShadow: "0 18px 48px rgba(0, 0, 0, .35)" }}
          />
          <Stack spacing={2.25} minWidth={0}>
            <Box>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h5" fontWeight={700}>SteamLoom</Typography>
                <Chip label="Writer" color="primary" size="small" />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>{t("app.about.tagline")}</Typography>
            </Box>
            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">{t("app.about.currentVersion")}</Typography>
                <Typography fontFamily="monospace">{version}</Typography>
              </Box>
              <Button variant="outlined" onClick={check} disabled={checking} startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}>
                {checking ? t("app.about.checking") : t("app.about.checkUpdate")}
              </Button>
            </Stack>
            {upToDate && <Typography variant="body2" color="success.main">{t("app.about.upToDate", { version })}</Typography>}
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
