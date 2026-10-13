import AddIcon from "@mui/icons-material/Add";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DoneIcon from "@mui/icons-material/Done";
import FolderIcon from "@mui/icons-material/Folder";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RemoveIcon from "@mui/icons-material/Remove";
import SortIcon from "@mui/icons-material/Sort";
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import {
  SidebarCollectionChildren,
  type ReorderSidebarItem,
} from "./ProjectWorkspaceSidebarTreeChildren.tsx";
import { WorkspaceSortArrows } from "./WorkspaceSortArrows.tsx";
import type { StorytellerStory } from "@/types/storyteller.ts";

export type SidebarRowData = {
  id: string;
  label: string;
  count?: number;
  stories?: StorytellerStory[];
};

export function SidebarGroup({
  title,
  section,
  icon,
  projectPublicId,
  selected,
  rows,
  onSelect,
  onSelectItem,
  selectedItem,
  onCreate,
  createLabel,
  onReorder,
  onReorderItem,
}: {
  title: string;
  section: WorkspaceSection;
  icon: ReactNode;
  projectPublicId?: string;
  selected: SelectedNode;
  rows: SidebarRowData[];
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
  onSelectItem: (item: SelectedItem, collectionId: string) => void;
  selectedItem?: { type: SelectedItem["type"]; publicId: string };
  onCreate?: () => void;
  // 新增按鈕的 tooltip 文字——預設沿用區塊標題「新增{title}」，但「作品與冊」
  // 這個按鈕實際上只會新增「冊」，不會新增「作品」，沿用預設會變成語意不對的
  // 「新增作品與冊」，所以呼叫端可以自己指定更精確的文字。
  createLabel?: string;
  // 排序模式（比照 SteamLoom Writer）：分組（冊、設定集）與冊內作品右側出現上移／下移，
  // 頭尾不顯示；不再用拖曳。onReorder 排分組，onReorderItem 排冊內作品。
  onReorder?: (draggedId: string, beforeId: string | null) => void;
  onReorderItem?: ReorderSidebarItem;
}) {
  const [expanded, setExpanded] = useState(true);
  const [sorting, setSorting] = useState(false);
  const reorderableRows = rows.filter(
    (row) => row.id !== "" && row.id !== ungroupedId,
  );
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1, py: 0.75 }}
      >
        <Tooltip title={expanded ? "收合" : "展開"}>
          <IconButton
            size="small"
            onClick={() => setExpanded((value) => !value)}
            sx={{ p: 0.375 }}
          >
            {expanded ? (
              <RemoveIcon fontSize="inherit" />
            ) : (
              <AddIcon fontSize="inherit" />
            )}
          </IconButton>
        </Tooltip>
        <Box sx={{ lineHeight: 0, opacity: 0.82 }}>{icon}</Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ letterSpacing: 0 }}
        >
          {title}
        </Typography>
        <Stack direction="row" sx={{ ml: "auto" }}>
          {onReorder && (
            <Tooltip title={sorting ? "完成排序" : `調整${title}順序`}>
              <IconButton
                size="small"
                aria-pressed={sorting}
                onClick={() => setSorting((value) => !value)}
                sx={{ p: 0.375 }}
              >
                {sorting ? (
                  <DoneIcon fontSize="inherit" />
                ) : (
                  <SortIcon fontSize="inherit" />
                )}
              </IconButton>
            </Tooltip>
          )}
          {onCreate && (
            <Tooltip title={createLabel ?? `新增${title}`}>
              <IconButton size="small" onClick={onCreate} sx={{ p: 0.375 }}>
                <CreateNewFolderIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Collapse in={expanded} timeout="auto">
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {rows.map((row) => {
            const reorderIndex = reorderableRows.findIndex(
              (item) => item.id === row.id,
            );
            return (
              <SidebarCollectionRow
                key={`${section}-${row.id}`}
                row={row}
                section={section}
                projectPublicId={projectPublicId}
                selected={selected}
                selectedItem={selectedItem}
                sorting={sorting}
                onSelect={onSelect}
                onSelectItem={onSelectItem}
                onReorderItem={onReorderItem}
                sortArrows={
                  sorting && onReorder && reorderIndex >= 0 ? (
                    <WorkspaceSortArrows
                      index={reorderIndex}
                      count={reorderableRows.length}
                      onMove={(delta) =>
                        onReorder(
                          row.id,
                          // 上移：插到前一個前面；下移：插到下下一個前面（沒有就排最後）
                          delta < 0
                            ? reorderableRows[reorderIndex - 1].id
                            : (reorderableRows[reorderIndex + 2]?.id ?? null),
                        )
                      }
                    />
                  ) : undefined
                }
              />
            );
          })}
        </List>
      </Collapse>
      <Divider sx={{ my: 0.75, opacity: 0.35 }} />
    </Box>
  );
}

export function SidebarCollectionRow({
  row,
  section,
  projectPublicId,
  selected,
  selectedItem,
  sorting,
  onSelect,
  onSelectItem,
  onReorderItem,
  sortArrows,
}: {
  row: SidebarRowData;
  section: WorkspaceSection;
  projectPublicId?: string;
  selected: SelectedNode;
  selectedItem?: { type: SelectedItem["type"]; publicId: string };
  sorting: boolean;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
  onSelectItem: (item: SelectedItem, collectionId: string) => void;
  onReorderItem?: ReorderSidebarItem;
  // 排序模式下這一列的上移／下移（「全部」「未分冊／未分類」這類虛擬節點沒有）
  sortArrows?: ReactNode;
}) {
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const canExpandChildren = section !== "assets";
  const hasChildren =
    canExpandChildren && row.id !== "" && (row.count ?? 0) > 0;
  const isSelected =
    selected.section === section && selected.collectionId === row.id;

  function toggleChildren(event: MouseEvent) {
    event.stopPropagation();
    if (!hasChildren) {
      return;
    }
    setChildrenExpanded((value) => {
      const nextValue = !value;
      if (nextValue) {
        setChildrenLoaded(true);
      }
      return nextValue;
    });
  }

  return (
    <>
      <Stack direction="row" alignItems="center" sx={{ minWidth: 0 }}>
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(section, row.id)}
          sx={{ ...sidebarTreeRowSx, flex: 1 }}
        >
          {canExpandChildren && (
            <Tooltip title={childrenExpanded ? "收合項目" : "展開項目"}>
              <Box
                onClick={toggleChildren}
                sx={{
                  width: 16,
                  lineHeight: 0,
                  flexShrink: 0,
                  visibility: hasChildren ? "visible" : "hidden",
                  cursor: hasChildren ? "pointer" : undefined,
                }}
              >
                <KeyboardArrowRightIcon
                  fontSize="inherit"
                  sx={{
                    transform: childrenExpanded ? "rotate(90deg)" : "none",
                    transition: "transform 120ms ease",
                  }}
                />
              </Box>
            </Tooltip>
          )}
          <ListItemIcon
            sx={{
              minWidth: 26,
              color: isSelected ? "primary.main" : "inherit",
            }}
          >
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={row.label}
            primaryTypographyProps={{
              fontWeight: 700,
              noWrap: true,
              fontSize: 13,
            }}
            sx={{ minWidth: 0 }}
          />
          {row.count !== undefined && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
            >
              {row.count}
            </Typography>
          )}
        </ListItemButton>
        {sortArrows && (
          <Stack direction="row" sx={{ flexShrink: 0 }}>
            {sortArrows}
          </Stack>
        )}
      </Stack>
      {canExpandChildren && (
        <Collapse in={childrenExpanded} timeout="auto">
          {childrenLoaded && (
            <SidebarCollectionChildren
              row={row}
              section={section}
              projectPublicId={projectPublicId}
              selectedItem={selectedItem}
              onSelectItem={onSelectItem}
              sorting={sorting}
              onReorderItem={onReorderItem}
            />
          )}
        </Collapse>
      )}
    </>
  );
}

const sidebarTreeRowSx: SxProps<Theme> = {
  borderRadius: 1,
  my: 0.125,
  minHeight: 30,
  px: 1,
  color: "text.secondary",
  "&:hover": { bgcolor: "action.hover" },
  "&.Mui-selected": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.13),
    color: "text.primary",
    borderLeft: 3,
    borderLeftColor: "primary.main",
    pl: 0.625,
  },
  "&.Mui-selected:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
  },
};
