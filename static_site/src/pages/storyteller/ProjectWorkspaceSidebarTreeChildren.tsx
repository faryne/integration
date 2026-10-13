import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import {
  Box,
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

// 側邊列每篇作品／設定 hover 時出現的 ⋮（跟列表同一份選單），由頁面提供
export type RenderSidebarItemActions = (item: SelectedItem) => ReactNode;

export function SidebarCollectionChildren({
  row,
  section,
  projectPublicId,
  selectedItem,
  onSelectItem,
  sorting,
  onReorderItem,
  renderItemActions,
}: {
  row: SidebarRowData;
  section: WorkspaceSection;
  projectPublicId?: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
  sorting?: boolean;
  onReorderItem?: ReorderSidebarItem;
  renderItemActions?: RenderSidebarItemActions;
}) {
  if (section === "stories") {
    return (
      <SidebarStoryChildren
        stories={row.stories ?? []}
        collectionId={row.id}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
        onReorderItem={sorting ? onReorderItem : undefined}
        renderItemActions={renderItemActions}
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
        renderItemActions={renderItemActions}
      />
    );
  }
  return null;
}

// onReorderItem 有值（排序模式）時每一篇右側出現上移／下移，跟 SteamLoom Writer 一樣只在同一冊內排序；
// 平常則是 hover 才出現的 ⋮
function SidebarStoryChildren({
  stories,
  collectionId,
  selectedItem,
  onSelectItem,
  onReorderItem,
  renderItemActions,
}: {
  stories: StorytellerStory[];
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
  onReorderItem?: ReorderSidebarItem;
  renderItemActions?: RenderSidebarItemActions;
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
          actions={renderItemActions?.({ type: "story", row: story })}
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
  renderItemActions,
}: {
  projectPublicId?: string;
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
  renderItemActions?: RenderSidebarItemActions;
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
          actions={renderItemActions?.({ type: "lore", row: lore })}
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
  actions,
}: {
  title: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
  // 列右側一直顯示的操作（排序模式的上移／下移）；有 extra 時不顯示 actions
  extra?: ReactNode;
  // 列右側 hover／鍵盤聚焦才出現的操作（⋮）；觸控裝置沒有 hover，一直顯示
  actions?: ReactNode;
}) {
  const side = extra || actions;
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
      {/* disableTypography：不要再多包一層 Typography，否則長標題（尤其沒有斷點的英文）的省略號失效、
          文字溢出蓋住右側的排序箭頭；overflow 隱藏再保險一次 */}
      <ListItemText
        disableTypography
        primary={
          <Tooltip title={title} placement="right">
            <Typography fontWeight={700} fontSize={12.5} noWrap>
              {title}
            </Typography>
          </Tooltip>
        }
        sx={{ minWidth: 0, overflow: "hidden" }}
      />
      {side && (
        // 擋掉冒泡：按右側按鈕不要順便打開這一篇（也不要觸發整列的 ripple）
        <Box
          className={extra ? undefined : sidebarItemActionsClass}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          sx={{ display: "flex", flexShrink: 0 }}
        >
          {side}
        </Box>
      )}
    </ListItemButton>
  );
}

const sidebarItemActionsClass = "sidebar-item-actions";

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
  [`& .${sidebarItemActionsClass}`]: { opacity: 0 },
  [`&:hover .${sidebarItemActionsClass}, &:focus-within .${sidebarItemActionsClass}`]:
    { opacity: 1 },
  "@media (hover: none)": {
    [`& .${sidebarItemActionsClass}`]: { opacity: 1 },
  },
  "&.Mui-selected": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
    color: "text.primary",
  },
  "&.Mui-selected:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
  },
};
