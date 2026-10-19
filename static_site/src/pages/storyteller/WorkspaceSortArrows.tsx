import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DoneIcon from "@mui/icons-material/Done";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { IconButton, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

// 側邊列排序相關的按鈕，網站與 SteamLoom Writer 共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。

// 側邊列小圖示按鈕的統一尺寸：區塊標題右側的排序／新增、排序模式的上移／下移都用這個
export const workspaceSidebarIconButtonSx = {
  p: 0.375,
  "& .MuiSvgIcon-root": { fontSize: 16 },
};
const iconSx = workspaceSidebarIconButtonSx;

// 區塊標題右側的排序模式開關：平常是 ⇅，排序中換成 ✓ 並用主色標示
export function WorkspaceSortToggle({
  sorting,
  onToggle,
  label,
  doneLabel,
}: {
  sorting: boolean;
  onToggle: () => void;
  label?: string;
  doneLabel?: string;
}) {
  const { t } = useTranslation();
  label ??= t("writer:sidebar.sort");
  doneLabel ??= t("writer:sidebar.sortDone");

  return (
    <Tooltip title={sorting ? doneLabel : label}>
      <IconButton
        size="small"
        sx={iconSx}
        color={sorting ? "primary" : "default"}
        aria-label={sorting ? doneLabel : label}
        aria-pressed={sorting}
        onClick={onToggle}
      >
        {sorting ? <DoneIcon /> : <SwapVertIcon />}
      </IconButton>
    </Tooltip>
  );
}

// 排序模式下每一列右側的上移／下移。
// 第一列沒有上移、最後一列沒有下移：用 visibility 藏起來而不是停用，保留位置讓整排箭頭對齊。
const hidden = { visibility: "hidden" } as const;

export function WorkspaceSortArrows({
  index,
  count,
  onMove,
  upLabel,
  downLabel,
}: {
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  upLabel?: string;
  downLabel?: string;
}) {
  const { t } = useTranslation();
  upLabel ??= t("writer:sidebar.moveUp");
  downLabel ??= t("writer:sidebar.moveDown");

  return (
    <>
      <IconButton
        size="small"
        sx={{ ...iconSx, ...(index === 0 && hidden) }}
        aria-label={upLabel}
        onClick={(event) => {
          // 列本身可點（選取分組／打開作品），按箭頭不能順便觸發
          event.stopPropagation();
          onMove(-1);
        }}
      >
        <ArrowUpwardIcon />
      </IconButton>
      <IconButton
        size="small"
        sx={{ ...iconSx, ...(index === count - 1 && hidden) }}
        aria-label={downLabel}
        onClick={(event) => {
          event.stopPropagation();
          onMove(1);
        }}
      >
        <ArrowDownwardIcon />
      </IconButton>
    </>
  );
}
