import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { IconButton, Tooltip } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// 工作台側邊列收合用的兩個小元件，網站與 SteamLoom Writer 共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。

// 浮貼在側邊列與內容交界的收合／展開按鈕；外層要是 position: relative 而且不能 overflow: hidden。
export function WorkspaceSidebarToggle({
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  collapsed: boolean;
  onToggle: () => void;
  collapseLabel?: string;
  expandLabel?: string;
}) {
  const { t } = useTranslation();
  collapseLabel ??= t("writer:sidebar.collapse");
  expandLabel ??= t("writer:sidebar.expand");

  return (
    <Tooltip title={collapsed ? expandLabel : collapseLabel}>
      <IconButton
        size="small"
        aria-label={collapsed ? expandLabel : collapseLabel}
        onClick={onToggle}
        sx={{
          position: "absolute",
          top: 12,
          right: -13,
          zIndex: 2,
          width: 26,
          height: 26,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {collapsed ? (
          <ChevronRightIcon fontSize="small" />
        ) : (
          <ChevronLeftIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}

// 收合後窄欄裡的一個圖示按鈕：滑過顯示名稱，選取中用主色＋淡底。
export function WorkspaceRailButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} placement="right">
      <IconButton
        size="small"
        aria-label={label}
        color={selected ? "primary" : "default"}
        onClick={onClick}
        sx={{
          borderRadius: 1,
          bgcolor: selected ? "action.selected" : undefined,
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
