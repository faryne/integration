import AddIcon from "@mui/icons-material/Add";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import FolderIcon from "@mui/icons-material/Folder";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RemoveIcon from "@mui/icons-material/Remove";
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
import { SidebarCollectionChildren } from "./ProjectWorkspaceSidebarTreeChildren.tsx";
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
  onReorder?: (draggedId: string, beforeId: string | null) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
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
        {onCreate && (
          <Tooltip title={createLabel ?? `新增${title}`}>
            <IconButton
              size="small"
              onClick={onCreate}
              sx={{ ml: "auto", p: 0.375 }}
            >
              <CreateNewFolderIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Collapse in={expanded} timeout="auto">
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {rows.map((row) => (
            <SidebarCollectionRow
              key={`${section}-${row.id}`}
              row={row}
              section={section}
              projectPublicId={projectPublicId}
              selected={selected}
              selectedItem={selectedItem}
              draggingId={draggingId}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onReorder={onReorder}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
            />
          ))}
          {onReorder && (
            // 補一塊有實際高度的拖放目標放在清單最後，讓使用者能把冊拖到最後一個
            // 位置（跟 WorkspacePane 作品清單拖曳排序同一個道理）。
            <Box
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingId) {
                  onReorder(draggingId, null);
                }
                setDraggingId(null);
              }}
              sx={{ minHeight: 10 }}
            />
          )}
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
  draggingId,
  onSelect,
  onSelectItem,
  onReorder,
  onDragStart,
  onDragEnd,
}: {
  row: SidebarRowData;
  section: WorkspaceSection;
  projectPublicId?: string;
  selected: SelectedNode;
  selectedItem?: { type: SelectedItem["type"]; publicId: string };
  draggingId: string | null;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
  onSelectItem: (item: SelectedItem, collectionId: string) => void;
  onReorder?: (draggedId: string, beforeId: string | null) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const hasChildren = row.id !== "" && (row.count ?? 0) > 0;
  // 「全部」「未分類/未分冊」是虛擬節點，不是實際的冊資料列，不能被拖曳排序，
  // 也不能當拖放目標；第三層展開則仍可支援未分冊/未分類。
  const reorderable =
    Boolean(onReorder) && row.id !== "" && row.id !== ungroupedId;
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
      <Tooltip
        title={reorderable ? "可拖曳調整順序" : ""}
        placement="right"
      >
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(section, row.id)}
          draggable={reorderable}
          onDragStart={reorderable ? () => onDragStart(row.id) : undefined}
          onDragOver={
            reorderable ? (event) => event.preventDefault() : undefined
          }
          onDrop={
            reorderable
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (draggingId) {
                    onReorder?.(draggingId, row.id);
                  }
                  onDragEnd();
                }
              : undefined
          }
          sx={{
            ...sidebarTreeRowSx,
            cursor: reorderable ? "grab" : undefined,
            opacity: draggingId === row.id ? 0.55 : 1,
          }}
        >
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
      </Tooltip>
      <Collapse in={childrenExpanded} timeout="auto">
        {childrenLoaded && (
          <SidebarCollectionChildren
            row={row}
            section={section}
            projectPublicId={projectPublicId}
            selectedItem={selectedItem}
            onSelectItem={onSelectItem}
          />
        )}
      </Collapse>
    </>
  );
}

const sidebarTreeRowSx: SxProps<Theme> = {
  borderRadius: 1,
  my: 0.125,
  minHeight: 30,
  px: 1,
  color: "text.secondary",
  "&:hover": {
    bgcolor: (theme) => (theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8"),
  },
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
