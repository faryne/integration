import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Chip, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { MediaWorker } from "@writer/lib/backend.ts";

const statusColor = (status: string): "success" | "error" | "default" =>
  status === "online" ? "success" : status === "error" ? "error" : "default";

export function WorkerRegistryList({ workers, selectedID, onSelect, onAdd }: {
  workers: MediaWorker[];
  selectedID: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ width: 300, flex: "none", borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
        <Typography fontWeight={600}>{t("settings.workers.title")}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>{t("settings.workers.add")}</Button>
      </Stack>
      {workers.length > 0 && (
        <List disablePadding sx={{ overflow: "auto" }}>
          {workers.map((worker) => (
            <ListItemButton key={worker.id} selected={worker.id === selectedID} onClick={() => onSelect(worker.id)} sx={{ borderTop: 1, borderColor: "divider", py: 1.25 }}>
              <ListItemText primary={worker.name} secondary={worker.enabled ? t("settings.workers.enabled") : undefined} primaryTypographyProps={{ noWrap: true }} />
              <Chip size="small" variant="outlined" color={statusColor(worker.status)} label={t(`settings.workers.status.${worker.status}`)} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
