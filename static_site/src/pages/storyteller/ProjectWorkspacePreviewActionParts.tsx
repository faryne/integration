import FolderIcon from "@mui/icons-material/Folder";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  workspaceDialogActionsSx,
  workspaceDialogBackdropSx,
  workspaceDialogContentSx,
  workspaceDialogPaperSx,
  workspaceDialogTitleSx,
  workspaceTextFieldSx,
} from "./ProjectWorkspacePreviewDialogStyles.ts";

export interface WorkspaceUploadProgressRow {
  name: string;
  loaded: number;
  total: number;
}

export function MoveMenu({
  anchorEl,
  open,
  disabled,
  currentId,
  rows,
  ungroupedLabel,
  onClose,
  onMove,
}: {
  anchorEl: HTMLElement | null;
  open: boolean;
  disabled: boolean;
  currentId: string | number | null;
  rows: Array<{ id: string | number; publicId: string; name: string }>;
  ungroupedLabel: string;
  onClose: () => void;
  onMove: (collectionId: string) => void;
}) {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      <MenuItem
        disabled={disabled || currentId === null || currentId === ""}
        onClick={() => onMove("")}
      >
        <ListItemIcon>
          <FolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{ungroupedLabel}</ListItemText>
      </MenuItem>
      {rows.map((row) => (
        <MenuItem
          key={row.publicId}
          disabled={disabled || currentId === row.id}
          onClick={() => onMove(row.publicId)}
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={row.name} />
        </MenuItem>
      ))}
    </Menu>
  );
}

export function CollectionDialog({
  open,
  title,
  name,
  description,
  loading,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  name: string;
  description: string;
  loading: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: { sx: workspaceDialogPaperSx },
        backdrop: { sx: workspaceDialogBackdropSx },
      }}
    >
      <DialogTitle sx={workspaceDialogTitleSx}>{title}</DialogTitle>
      <DialogContent sx={workspaceDialogContentSx}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t("writer.collectionDialog.name")}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            fullWidth
            sx={workspaceTextFieldSx}
          />
          <TextField
            label={t("writer.collectionDialog.notes")}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            fullWidth
            multiline
            minRows={3}
            sx={workspaceTextFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={workspaceDialogActionsSx}>
        <Button onClick={onClose}>{t("writer.common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={loading || !name.trim()}
          onClick={onSubmit}
        >
          {t("writer.common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UploadProgressToast({
  rows,
}: {
  rows: WorkspaceUploadProgressRow[];
}) {
  const { t } = useTranslation();
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const loaded = rows.reduce((sum, row) => sum + row.loaded, 0);
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <Stack
      spacing={1}
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        width: 320,
        zIndex: 1500,
        p: 2,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Typography fontWeight={800}>{t("writer.collectionDialog.uploading", { percent })}</Typography>
      <LinearProgress variant="determinate" value={percent} />
      {rows.slice(0, 3).map((row) => (
        <Typography
          key={row.name}
          variant="caption"
          color="text.secondary"
          noWrap
        >
          {row.name}
        </Typography>
      ))}
    </Stack>
  );
}
