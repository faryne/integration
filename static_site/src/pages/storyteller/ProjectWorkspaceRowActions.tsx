import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PublicIcon from "@mui/icons-material/Public";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import type { MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

/** Row 本身已能進入編輯，右側只保留單一 overflow 入口，避免 mobile 操作擠成一排。 */
export function WorkspaceRowActionButton({
  label,
  onOpen,
}: {
  label: string;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={onOpen}
        sx={{ p: { xs: 1.25, sm: 0.75 } }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

export function WorkspaceRowActionMenu({
  anchorEl,
  editTo,
  editLabel,
  moveLabel,
  deleteLabel,
  status,
  disabled,
  onClose,
  onToggleStatus,
  onMove,
  onDelete,
}: {
  anchorEl: HTMLElement | null;
  editTo: string;
  editLabel: string;
  moveLabel: string;
  deleteLabel: string;
  status?: "completed" | "draft";
  disabled?: boolean;
  onClose: () => void;
  onToggleStatus?: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const isPublic = status === "completed";
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{ paper: { sx: { minWidth: 190 } } }}
    >
      <MenuItem component={RouterLink} to={editTo} onClick={onClose}>
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{editLabel}</ListItemText>
      </MenuItem>
      {status && onToggleStatus && (
        <MenuItem disabled={disabled} onClick={onToggleStatus}>
          <ListItemIcon>
            {isPublic ? (
              <VisibilityOffOutlinedIcon fontSize="small" />
            ) : (
              <PublicIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>{isPublic ? "設為草稿" : "設為公開"}</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={onMove}>
        <ListItemIcon>
          <DriveFileMoveOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{moveLabel}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={onDelete} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "inherit" }}>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{deleteLabel}</ListItemText>
      </MenuItem>
    </Menu>
  );
}
