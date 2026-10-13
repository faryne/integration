import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { IconButton } from "@mui/material";

// 側邊列排序模式下每一列右側的上移／下移，網站與 SteamLoom Writer 共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。
// 第一列沒有上移、最後一列沒有下移：用 visibility 藏起來而不是停用，保留位置讓整排箭頭對齊。
const iconSx = { p: 0.375, "& .MuiSvgIcon-root": { fontSize: 16 } };
const hidden = { visibility: "hidden" } as const;

export function WorkspaceSortArrows({
  index,
  count,
  onMove,
  upLabel = "往上移",
  downLabel = "往下移",
}: {
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  upLabel?: string;
  downLabel?: string;
}) {
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
