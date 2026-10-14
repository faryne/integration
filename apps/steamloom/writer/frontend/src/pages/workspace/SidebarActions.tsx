import { WorkspaceSortArrows, WorkspaceSortToggle, workspaceSidebarIconButtonSx } from "@/pages/storyteller/WorkspaceSortArrows.tsx";
import AddIcon from "@mui/icons-material/Add";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

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
        <WorkspaceSortToggle sorting={Boolean(sorting)} onToggle={onToggleSort} label={t("workspace.actions.sort")} doneLabel={t("workspace.actions.sortDone")} />
      )}
      <Tooltip title={t("workspace.actions.create")}>
        <IconButton size="small" sx={workspaceSidebarIconButtonSx} onClick={openCreate}>
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
