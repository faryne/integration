import { Box, Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { WorkerAdapter } from "@writer/lib/backend.ts";
import { useWorkerI18n } from "@writer/pages/settings/workerI18n.ts";

export function AddWorkerDialog({ open, adapters, onClose, onSelect }: {
  open: boolean;
  adapters: WorkerAdapter[];
  onClose: () => void;
  onSelect: (adapter: WorkerAdapter) => void;
}) {
  const { t } = useTranslation();
  const workerText = useWorkerI18n();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("settings.workers.addTitle")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>{t("settings.workers.addHint")}</Typography>
        <List disablePadding>
          {adapters.map((adapter) => (
            <ListItemButton key={adapter.id} onClick={() => onSelect(adapter)} sx={{ border: 1, borderColor: "divider", borderRadius: 1, mb: 1 }}>
              <ListItemText primary={workerText.adapterName(adapter)} secondary={workerText.adapterDescription(adapter)} />
              <Box sx={{ color: "text.secondary", fontSize: 12 }}>{adapter.media_types.map(workerText.mediaType).join(" · ")}</Box>
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
