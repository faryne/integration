import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import {
  CircularProgress,
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
import type { ReactNode } from "react";
import { useStorytellerLores } from "@/apis/storyteller.ts";
import { WorkspaceSortArrows } from "./WorkspaceSortArrows.tsx";
import {
  ungroupedId,
  type SelectedItem,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import type { StorytellerStory } from "@/types/storyteller.ts";

type SidebarSelectedItem = { type: SelectedItem["type"]; publicId: string };
type SelectSidebarItem = (item: SelectedItem, collectionId: string) => void;
// 同一冊內調整作品順序：把 draggedId 插到 beforeId 前面（null＝最後）
export type ReorderSidebarItem = (
  collectionId: string,
  draggedId: string,
  beforeId: string | null,
) => void;

type SidebarRowData = {
  id: string;
  stories?: StorytellerStory[];
};

export function SidebarCollectionChildren({
  row,
  section,
  projectPublicId,
  selectedItem,
  onSelectItem,
  sorting,
  onReorderItem,
}: {
  row: SidebarRowData;
  section: WorkspaceSection;
  projectPublicId?: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
  sorting?: boolean;
  onReorderItem?: ReorderSidebarItem;
}) {
  if (section === "stories") {
    return (
      <SidebarStoryChildren
        stories={row.stories ?? []}
        collectionId={row.id}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
        onReorderItem={sorting ? onReorderItem : undefined}
      />
    );
  }
  if (section === "lores") {
    return (
      <SidebarLoreChildren
        projectPublicId={projectPublicId}
        collectionId={row.id}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
      />
    );
  }
  return null;
}

// onReorderItem 有值（排序模式）時每一篇右側出現上移／下移，跟 SteamLoom Writer 一樣只在同一冊內排序
function SidebarStoryChildren({
  stories,
  collectionId,
  selectedItem,
  onSelectItem,
  onReorderItem,
}: {
  stories: StorytellerStory[];
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
  onReorderItem?: ReorderSidebarItem;
}) {
  return (
    <List dense disablePadding sx={sidebarChildListSx}>
      {stories.map((story, index) => (
        <SidebarTreeItem
          key={story.public_id}
          title={story.title}
          icon={
            story.content_type === "image" ? (
              <ImageIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )
          }
          selected={
            selectedItem?.type === "story" &&
            selectedItem.publicId === story.public_id
          }
          onClick={() =>
            onSelectItem({ type: "story", row: story }, collectionId)
          }
          extra={
            onReorderItem && (
              <WorkspaceSortArrows
                index={index}
                count={stories.length}
                onMove={(delta) =>
                  onReorderItem(
                    collectionId,
                    story.public_id,
                    // 上移：插到前一篇前面；下移：插到下下一篇前面（沒有就排最後）
                    delta < 0
                      ? stories[index - 1].public_id
                      : (stories[index + 2]?.public_id ?? null),
                  )
                }
              />
            )
          }
        />
      ))}
    </List>
  );
}

function SidebarLoreChildren({
  projectPublicId,
  collectionId,
  selectedItem,
  onSelectItem,
}: {
  projectPublicId?: string;
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
}) {
  const loresQuery = useStorytellerLores(projectPublicId);
  const lores = (loresQuery.data ?? []).filter((lore) =>
    collectionId === ungroupedId
      ? !lore.collection_id
      : lore.collection_id === collectionId,
  );
  return (
    <SidebarAsyncChildren loading={loresQuery.isLoading}>
      {lores.map((lore) => (
        <SidebarTreeItem
          key={lore.public_id}
          title={lore.title}
          icon={<DescriptionIcon fontSize="small" />}
          selected={
            selectedItem?.type === "lore" &&
            selectedItem.publicId === lore.public_id
          }
          onClick={() =>
            onSelectItem({ type: "lore", row: lore }, collectionId)
          }
        />
      ))}
    </SidebarAsyncChildren>
  );
}

function SidebarAsyncChildren({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 0.75, pl: 5.25 }}>
        <CircularProgress size={16} />
      </Stack>
    );
  }
  return (
    <List dense disablePadding sx={sidebarChildListSx}>
      {children}
    </List>
  );
}

function SidebarTreeItem({
  title,
  icon,
  selected,
  onClick,
  extra,
}: {
  title: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
  // 列右側的操作（排序模式的上移／下移）
  extra?: ReactNode;
}) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={sidebarChildRowSx}
    >
      <ListItemIcon
        sx={{
          minWidth: 24,
          color: selected ? "primary.main" : "inherit",
        }}
      >
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={
          <Tooltip title={title} placement="right">
            <Typography fontWeight={700} fontSize={12.5} noWrap>
              {title}
            </Typography>
          </Tooltip>
        }
        sx={{ minWidth: 0 }}
      />
      {extra}
    </ListItemButton>
  );
}

const sidebarChildListSx: SxProps<Theme> = {
  py: 0.25,
};

const sidebarChildRowSx: SxProps<Theme> = {
  borderRadius: 1,
  my: 0.125,
  minHeight: 28,
  ml: 3.75,
  mr: 0.5,
  pr: 0.75,
  color: "text.secondary",
  "&:hover": { bgcolor: "action.hover" },
  "&.Mui-selected": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
    color: "text.primary",
  },
  "&.Mui-selected:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
  },
};
