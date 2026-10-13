import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
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

/** Row 本身已能進入編輯，右側只保留單一 overflow 入口，避免 mobile 操作擠成一排。
 * 網站工作台與 SteamLoom Writer 的作品／設定列表共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。 */
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

// 列的 ⋮ 選單：公開狀態切換（有給 onToggleStatus 才出現）、移動、刪除。
// 不放「編輯」：點列本身就會打開編輯頁，選單再放一次只是重複。
export function WorkspaceRowActionMenu({
  anchorEl,
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
