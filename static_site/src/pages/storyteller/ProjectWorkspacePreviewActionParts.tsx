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
import { useEffect, useState } from "react";
import {
  workspaceDialogActionsSx,
  workspaceDialogBackdropSx,
  workspaceDialogContentSx,
  workspaceDialogPaperSx,
  workspaceDialogTitleSx,
  workspaceTextFieldSx,
} from "./ProjectWorkspacePreviewDialogStyles.ts";
import type { StorytellerAssetUpdateRequest } from "@/types/storyteller.ts";

export interface WorkspaceUploadProgressRow {
  name: string;
  loaded: number;
  total: number;
}

export function WorkspaceConfirmNameDialog({
  open,
  title,
  description,
  confirmName,
  confirmLabel,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmName: string;
  confirmLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  const matched = value === confirmName;

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: { sx: workspaceDialogPaperSx },
        backdrop: { sx: workspaceDialogBackdropSx },
      }}
    >
      <DialogTitle sx={workspaceDialogTitleSx}>{title}</DialogTitle>
      <DialogContent sx={workspaceDialogContentSx}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography color="text.secondary">{description}</Typography>
          <TextField
            autoFocus
            fullWidth
            label="確認名稱"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            helperText={`請輸入「${confirmName}」以啟用確認按鈕。`}
            sx={workspaceTextFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={workspaceDialogActionsSx}>
        <Button onClick={onClose}>取消</Button>
        <Button
          color="error"
          variant="contained"
          disabled={!matched || loading}
          onClick={onConfirm}
        >
          {loading ? "處理中" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
            label="名稱"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            fullWidth
            sx={workspaceTextFieldSx}
          />
          <TextField
            label="用途筆記"
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
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={loading || !name.trim()}
          onClick={onSubmit}
        >
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AssetEditDialog({
  open,
  form,
  loading,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: StorytellerAssetUpdateRequest;
  loading: boolean;
  onChange: (form: StorytellerAssetUpdateRequest) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
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
      <DialogTitle sx={workspaceDialogTitleSx}>編輯資產資訊</DialogTitle>
      <DialogContent sx={workspaceDialogContentSx}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="標題"
            value={form.title}
            onChange={(event) =>
              onChange({ ...form, title: event.target.value })
            }
            fullWidth
            sx={workspaceTextFieldSx}
          />
          <TextField
            label="替代文字"
            value={form.alt_text}
            onChange={(event) =>
              onChange({ ...form, alt_text: event.target.value })
            }
            fullWidth
            sx={workspaceTextFieldSx}
          />
          <TextField
            label="描述"
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            fullWidth
            multiline
            minRows={3}
            sx={workspaceTextFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={workspaceDialogActionsSx}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={loading} onClick={onSubmit}>
          儲存
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
      <Typography fontWeight={800}>正在上傳資產 {percent}%</Typography>
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
