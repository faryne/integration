import { WorkspaceSortArrows } from "@/pages/storyteller/WorkspaceSortArrows.tsx";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { IconButton, ListSubheader, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MoveTarget } from "@writer/pages/workspace/workspaceTree.ts";

const iconSx = { p: 0.375, "& .MuiSvgIcon-root": { fontSize: 16 } };

// 排序模式下每一列右側的上移／下移：用網站共用的 WorkspaceSortArrows，這裡只補上語系文字
export function SortArrows(props: { index: number; count: number; onMove: (delta: -1 | 1) => void }) {
  const { t } = useTranslation();
  return <WorkspaceSortArrows {...props} upLabel={t("workspace.actions.moveUp")} downLabel={t("workspace.actions.moveDown")} />;
}

// 區塊標題右側：排序模式開關（有可排序的對象才出現）＋「建立」選單（只有一種可建立時直接開對話框）
export function SectionActions({
  sorting,
  onToggleSort,
  createKinds,
  onCreate,
}: {
  sorting?: boolean;
  onToggleSort?: () => void;
  createKinds: string[];
  onCreate: (kind: string) => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const openCreate = (event: MouseEvent<HTMLElement>) =>
    createKinds.length === 1 ? onCreate(createKinds[0]) : setAnchor(event.currentTarget);
  return (
    <>
      {onToggleSort && (
        <Tooltip title={t(sorting ? "workspace.actions.sortDone" : "workspace.actions.sort")}>
          <IconButton size="small" sx={iconSx} color={sorting ? "primary" : "default"} onClick={onToggleSort}>
            {sorting ? <DoneIcon /> : <SwapVertIcon />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t("workspace.actions.create")}>
        <IconButton size="small" sx={iconSx} onClick={openCreate}>
          <AddIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {createKinds.map((kind) => (
          <MenuItem
            key={kind}
            dense
            onClick={() => {
              setAnchor(null);
              onCreate(kind);
            }}
          >
            {t(`workspace.create.kinds.${kind}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}


// 文件右側的 ⋮：「移動到冊／設定集」，列出未分冊（未歸類）與各分組，目前所在的那一組不能選
export function MoveMenuButton({
  title,
  targets,
  current,
  onMove,
}: {
  title: string;
  targets: MoveTarget[];
  current: string;
  onMove: (publicId: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton size="small" sx={iconSx} aria-label={title} onClick={(event) => setAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <ListSubheader sx={{ lineHeight: "32px" }}>{title}</ListSubheader>
        {targets.map((target) => (
          <MenuItem
            key={target.publicId || "ungrouped"}
            dense
            disabled={target.publicId === current}
            onClick={() => {
              setAnchor(null);
              onMove(target.publicId);
            }}
          >
            {target.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
