import { Box, Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { WorkerAdapter } from "@writer/lib/backend.ts";

export function AddWorkerDialog({ open, adapters, onClose, onSelect }: {
  open: boolean;
  adapters: WorkerAdapter[];
  onClose: () => void;
  onSelect: (adapter: WorkerAdapter) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("settings.workers.addTitle")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>{t("settings.workers.addHint")}</Typography>
        <List disablePadding>
          {adapters.map((adapter) => (
            <ListItemButton key={adapter.id} onClick={() => onSelect(adapter)} sx={{ border: 1, borderColor: "divider", borderRadius: 1, mb: 1 }}>
              <ListItemText primary={adapter.name} secondary={adapter.description} />
              <Box sx={{ color: "text.secondary", fontSize: 12 }}>{adapter.media_types.join(" · ")}</Box>
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
