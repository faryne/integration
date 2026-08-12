import AddIcon from "@mui/icons-material/Add";
import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveIcon from "@mui/icons-material/Remove";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Pagination,
  Paper,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useDeleteStorytellerProject } from "@/apis/storyteller.ts";
import {
  storytellerPaletteMeta,
  type StorytellerPaletteName,
} from "@/data/storytellerTheme.ts";
import { storytellerReaderPath } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerPalette } from "@/layouts/storytellerPaletteMode.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { WorkspaceConfirmNameDialog } from "./ProjectWorkspacePreviewActionParts.tsx";
import {
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import {
  AssetCard,
  LoreRow,
  StoryRow,
} from "./ProjectWorkspacePreviewRows.tsx";
import type {
  StorytellerAsset,
  StorytellerLore,
  StorytellerProject,
  StorytellerStory,
} from "@/types/storyteller.ts";

export function WorkspaceSidebar({
  project,
  selected,
  stories,
  volumes,
  loreCollections,
  assetCollections,
  onSelect,
  onCreateVolume,
  onCreateLoreCollection,
  onCreateAssetCollection,
  onReorderVolume,
}: {
  project?: StorytellerProject;
  selected: SelectedNode;
  stories: StorytellerStory[];
  volumes: StorytellerStory[];
  loreCollections: Array<{
    public_id: string;
    name: string;
    lore_count: number;
  }>;
  assetCollections: Array<{
    public_id: string;
    name: string;
    asset_count: number;
  }>;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
  onCreateVolume?: () => void;
  onCreateLoreCollection?: () => void;
  onCreateAssetCollection?: () => void;
  onReorderVolume?: (draggedId: string, beforeId: string | null) => void;
}) {
  const storyCount = stories.filter((story) => !story.is_volume).length;
  const ungroupedStoryCount = stories.filter(
    (story) => !story.is_volume && story.parent_id === null,
  ).length;
  return (
    <Stack sx={{ height: 1, color: "text.secondary" }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1, pb: 0 }}>
        {project && <ProjectActionsGroup project={project} />}
        <SidebarGroup
          title="作品與冊"
          section="stories"
          icon={<AutoStoriesIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部作品", count: storyCount },
            { id: ungroupedId, label: "未分冊", count: ungroupedStoryCount },
            ...volumes.map((volume) => ({
              id: volume.public_id,
              label: volume.title,
              count: stories.filter((story) => story.parent_id === volume.id)
                .length,
            })),
          ]}
          onSelect={onSelect}
          onCreate={onCreateVolume}
          createLabel="新增冊"
          onReorder={onReorderVolume}
        />
        <SidebarGroup
          title="設定集"
          section="lores"
          icon={<SettingsIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部設定" },
            { id: ungroupedId, label: "未分類" },
            ...loreCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.lore_count,
            })),
          ]}
          onSelect={onSelect}
          onCreate={onCreateLoreCollection}
        />
        <SidebarGroup
          title="資產集"
          section="assets"
          icon={<CollectionsIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部資產" },
            { id: ungroupedId, label: "未分類" },
            ...assetCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.asset_count,
            })),
          ]}
          onSelect={onSelect}
          onCreate={onCreateAssetCollection}
        />
      </Box>
      <WorkspaceSidebarFooter />
    </Stack>
  );
}

function SidebarGroup({
  title,
  section,
  icon,
  selected,
  rows,
  onSelect,
  onCreate,
  createLabel,
  onReorder,
}: {
  title: string;
  section: WorkspaceSection;
  icon: ReactNode;
  selected: SelectedNode;
  rows: Array<{ id: string; label: string; count?: number }>;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
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
          {rows.map((row) => {
            const hasChildren = row.id !== "" && (row.count ?? 0) > 0;
            // 「全部」「未分類/未分冊」是虛擬節點，不是實際的冊資料列，不能被拖曳
            // 排序，也不能當拖放目標。
            const reorderable =
              Boolean(onReorder) && row.id !== "" && row.id !== ungroupedId;
            return (
              <Tooltip
                key={`${section}-${row.id}`}
                title={reorderable ? "可拖曳調整順序" : ""}
                placement="right"
              >
                <ListItemButton
                  selected={
                    selected.section === section &&
                    selected.collectionId === row.id
                  }
                  onClick={() => onSelect(section, row.id)}
                  draggable={reorderable}
                  onDragStart={
                    reorderable ? () => setDraggingId(row.id) : undefined
                  }
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
                          setDraggingId(null);
                        }
                      : undefined
                  }
                  sx={{
                    borderRadius: 1,
                    my: 0.125,
                    minHeight: 30,
                    px: 1,
                    color: "text.secondary",
                    cursor: reorderable ? "grab" : undefined,
                    opacity: draggingId === row.id ? 0.55 : 1,
                    "&:hover": {
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8",
                    },
                    "&.Mui-selected": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.13),
                      color: "text.primary",
                      borderLeft: 3,
                      borderLeftColor: "primary.main",
                      pl: 0.625,
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.16),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 16,
                      lineHeight: 0,
                      visibility: hasChildren ? "visible" : "hidden",
                    }}
                  >
                    <KeyboardArrowRightIcon fontSize="inherit" />
                  </Box>
                  <ListItemIcon
                    sx={{
                      minWidth: 26,
                      color:
                        selected.section === section &&
                        selected.collectionId === row.id
                          ? "primary.main"
                          : "inherit",
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
                  />
                  {row.count !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      {row.count}
                    </Typography>
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
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

// 「編輯專案」「開啟閱讀頁」「刪除專案」這幾個原本只有 /project/:id 那個舊頁面才有的
// 專案層級操作——Notion 風工作台預覽頁一直沒有對應入口，使用者進來後找不到，補一個
// 側邊欄群組放這些功能，跟其他分組共用同一套「展開/收合＋列表」視覺語言。
function ProjectActionsGroup({ project }: { project: StorytellerProject }) {
  const [expanded, setExpanded] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const deleteProject = useDeleteStorytellerProject();
  // 「編輯專案」現在是一個真正的路由（my/workspace/:id/edit），跟其他分組列表項目
  // 一樣要能反映「目前正在這個畫面」——不然使用者點進編輯表單後，側邊欄看起來
  // 什麼都沒被選中，容易懷疑自己是不是點錯了。
  const isEditActive = location.pathname.endsWith("/edit");
  const readerUrl =
    project.visibility === "unlisted" && project.share_token
      ? steamloomPath(`work/share/${project.share_token}`)
      : storytellerReaderPath(project);

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
        <Box sx={{ lineHeight: 0, opacity: 0.82 }}>
          <FolderSpecialIcon fontSize="small" />
        </Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ letterSpacing: 0 }}
        >
          專案
        </Typography>
      </Stack>
      <Collapse in={expanded} timeout="auto">
        <List dense disablePadding sx={{ mt: 0.5 }}>
          <ListItemButton
            component={RouterLink}
            to={steamloomPath(`my/workspace/${project.public_id}/edit`)}
            selected={isEditActive}
            sx={sidebarActionRowSx}
          >
            <ListItemIcon
              sx={{
                minWidth: 26,
                color: isEditActive ? "primary.main" : "inherit",
              }}
            >
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="編輯專案"
              primaryTypographyProps={{
                fontWeight: 700,
                noWrap: true,
                fontSize: 13,
              }}
            />
          </ListItemButton>
          <ListItemButton
            component="a"
            href={readerUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={sidebarActionRowSx}
          >
            <ListItemIcon sx={{ minWidth: 26 }}>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="開啟閱讀頁"
              primaryTypographyProps={{
                fontWeight: 700,
                noWrap: true,
                fontSize: 13,
              }}
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => setDeleteOpen(true)}
            sx={{ ...sidebarActionRowSx, color: "error.main" }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: "inherit" }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="刪除專案"
              primaryTypographyProps={{
                fontWeight: 700,
                noWrap: true,
                fontSize: 13,
              }}
            />
          </ListItemButton>
        </List>
      </Collapse>
      <Divider sx={{ my: 0.75, opacity: 0.35 }} />
      <WorkspaceConfirmNameDialog
        open={deleteOpen}
        title="刪除專案"
        description="刪除後會移除專案與底下故事資料。請輸入專案名稱確認。"
        confirmName={project.name}
        confirmLabel="刪除專案"
        loading={deleteProject.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteProject.mutate(project.public_id, {
            onSuccess: () => navigate(steamloomPath("my/projects")),
          })
        }
      />
    </Box>
  );
}

const sidebarActionRowSx: SxProps<Theme> = {
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

export function WorkspaceSidebarFooter() {
  const { palette, setPalette } = useStorytellerPalette();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentPalette = storytellerPaletteMeta[palette];

  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        px: 1,
        pt: 1.25,
        pb: 0.75,
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
        borderTop: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
        flexShrink: 0,
      }}
    >
      <ListItemButton
        onClick={() => setPaletteOpen((value) => !value)}
        sx={{ minHeight: 30, px: 1, borderRadius: 1 }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: currentPalette.swatch,
            border: 1,
            borderColor: "divider",
            mr: 1,
            flexShrink: 0,
          }}
        />
        <ListItemText
          primary={`色系：${currentPalette.label}`}
          primaryTypographyProps={{ variant: "caption", noWrap: true }}
        />
        <KeyboardArrowRightIcon
          fontSize="small"
          sx={{
            transform: paletteOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
          }}
        />
      </ListItemButton>
      <Collapse in={paletteOpen} timeout="auto" unmountOnExit>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={0.75}
          sx={{ p: 1 }}
        >
          {(
            Object.keys(storytellerPaletteMeta) as StorytellerPaletteName[]
          ).map((name) => {
            const meta = storytellerPaletteMeta[name];
            const isActive = palette === name;
            return (
              <Tooltip key={name} title={meta.label}>
                <Box
                  component="button"
                  type="button"
                  aria-label={`切換為${meta.label}色系`}
                  aria-pressed={isActive}
                  onClick={() => setPalette(name)}
                  sx={{
                    width: 20,
                    height: 20,
                    p: 0,
                    border: "2px solid",
                    borderColor: isActive ? "text.primary" : "divider",
                    borderRadius: "50%",
                    bgcolor: meta.swatch,
                    cursor: "pointer",
                  }}
                />
              </Tooltip>
            );
          })}
        </Stack>
      </Collapse>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 1, pt: 1.25, lineHeight: 1.35 }}
      >
        SteamLoom powered By Faryne
        <br />
        <Typography
          component="a"
          variant="caption"
          href="https://faryne.dev/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "underline" }}
        >
          faryne.dev
        </Typography>
      </Typography>
    </Box>
  );
}

export function WorkspaceMobileNav(
  props: Parameters<typeof WorkspaceSidebar>[0],
) {
  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxHeight: 280,
          overflow: "auto",
          borderRadius: 1,
          bgcolor: "transparent",
        }}
      >
        <WorkspaceSidebar {...props} />
      </Paper>
    </Box>
  );
}

export function WorkspacePane({
  title,
  selected,
  stories,
  lores,
  assets,
  volumes,
  loreCollections,
  assetCollections,
  loading,
  errorCode,
  errorBackUrl,
  onSelectItem,
  onSelectCollection,
  actions,
  titleActions,
  pagination,
  renderStoryActions,
  renderLoreActions,
  renderAssetActions,
  onReorderStory,
}: {
  title: string;
  selected: SelectedNode;
  stories: StorytellerStory[];
  lores: StorytellerLore[];
  assets: StorytellerAsset[];
  // 用來把故事/設定/資產各自的 parent_id／collection_id 換成冊／設定集／資產集
  // 名稱——只有「全部」這種混合分組的列表才需要標出每一列實際屬於哪個分組。
  volumes: StorytellerStory[];
  loreCollections: Array<{ public_id: string; name: string }>;
  assetCollections: Array<{ public_id: string; name: string }>;
  loading: boolean;
  // API 請求失敗時要顯示對應的錯誤頁，跟「請求成功但真的沒有資料」的空狀態
  // 分開處理，不能只看陣列是不是空的就顯示「沒有作品」——那樣使用者會誤以為
  // 這個分類真的沒東西，而不是資料根本沒載入成功。
  errorCode?: number;
  // 錯誤頁「回前頁」按鈕的目標——工作台根目錄，不是整個網站的首頁。
  errorBackUrl?: string;
  onSelectItem: (item: SelectedItem) => void;
  // 點擊列表項目上標出的冊／設定集／資產集 chip 時，直接切換到那個分組。
  onSelectCollection: (collectionId: string) => void;
  actions?: ReactNode;
  titleActions?: ReactNode;
  pagination?: {
    count: number;
    page: number;
    onChange: (page: number) => void;
  };
  renderStoryActions?: (story: StorytellerStory) => ReactNode;
  renderLoreActions?: (lore: StorytellerLore) => ReactNode;
  renderAssetActions?: (asset: StorytellerAsset) => ReactNode;
  // 只有「單一分組」的作品清單（某一冊、或未分冊）才能拖曳排序——「全部作品」
  // 混雜多個分組又沒有視覺分隔，拖曳語意不明確，由呼叫端決定要不要傳這個 callback。
  onReorderStory?: (
    draggedPublicId: string,
    beforePublicId: string | null,
  ) => void;
}) {
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  function collectionChipFor(label: string | undefined, collectionId: string) {
    if (!label) {
      return undefined;
    }
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<FolderIcon fontSize="small" />}
        label={label}
        onClick={(event) => {
          event.stopPropagation();
          onSelectCollection(collectionId);
        }}
        sx={{ height: 22, borderRadius: 1, fontWeight: 700 }}
      />
    );
  }
  const count =
    selected.section === "stories"
      ? stories.length
      : selected.section === "lores"
        ? lores.length
        : assets.length;
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            工作台 / {loading ? "同步中" : `${count} 個項目`}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Typography
              variant="h3"
              fontWeight={700}
              color="primary.main"
              sx={{ letterSpacing: 0, minWidth: 0 }}
              noWrap
            >
              {title}
            </Typography>
            {titleActions && <Box sx={{ flexShrink: 0 }}>{titleActions}</Box>}
          </Stack>
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>
      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : errorCode ? (
        <ErrorPage compact code={errorCode} backUrl={errorBackUrl} />
      ) : (
        <>
          {selected.section === "stories" && (
            <Stack spacing={0.5}>
              {stories.map((story) => {
                const volume = volumes.find(
                  (item) => item.id === story.parent_id,
                );
                return (
                  <StoryRow
                    key={story.public_id}
                    story={story}
                    actions={renderStoryActions?.(story)}
                    collectionChip={collectionChipFor(
                      volume?.title,
                      volume?.public_id ?? "",
                    )}
                    onClick={() => onSelectItem({ type: "story", row: story })}
                    reorderable={Boolean(onReorderStory)}
                    dragging={draggingStoryId === story.public_id}
                    onDragStart={() => setDraggingStoryId(story.public_id)}
                    onDropRow={() => {
                      if (draggingStoryId) {
                        onReorderStory?.(draggingStoryId, story.public_id);
                      }
                      setDraggingStoryId(null);
                    }}
                  />
                );
              })}
              {onReorderStory && stories.length > 0 && (
                // 補一塊有實際高度的拖放目標，放在清單最後一項後面——沒有這塊的話
                // 容器範圍會直接貼齊最後一項卡片下緣，使用者沒辦法把項目拖到最後。
                <Box
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingStoryId) {
                      onReorderStory(draggingStoryId, null);
                    }
                    setDraggingStoryId(null);
                  }}
                  sx={{ minHeight: 16 }}
                />
              )}
              {stories.length === 0 && (
                <WorkspaceEmptyState
                  icon={<ArticleIcon />}
                  title="沒有作品"
                  description="這個分類目前沒有作品。"
                />
              )}
              {pagination && pagination.count > 1 && (
                <Box
                  sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}
                >
                  <Pagination
                    count={pagination.count}
                    page={pagination.page}
                    onChange={(_, page) => pagination.onChange(page)}
                    color="primary"
                  />
                </Box>
              )}
            </Stack>
          )}
          {selected.section === "lores" && (
            <Stack spacing={0.5}>
              {lores.map((lore) => {
                const collection = loreCollections.find(
                  (item) => item.public_id === lore.collection_id,
                );
                return (
                  <LoreRow
                    key={lore.public_id}
                    lore={lore}
                    actions={renderLoreActions?.(lore)}
                    collectionChip={collectionChipFor(
                      collection?.name,
                      collection?.public_id ?? "",
                    )}
                    onClick={() => onSelectItem({ type: "lore", row: lore })}
                  />
                );
              })}
              {lores.length === 0 && (
                <WorkspaceEmptyState
                  icon={<DescriptionIcon />}
                  title="沒有設定"
                  description="這個分類目前沒有設定。"
                />
              )}
              {pagination && pagination.count > 1 && (
                <Box
                  sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}
                >
                  <Pagination
                    count={pagination.count}
                    page={pagination.page}
                    onChange={(_, page) => pagination.onChange(page)}
                    color="primary"
                  />
                </Box>
              )}
            </Stack>
          )}
          {selected.section === "assets" && (
            <Grid container spacing={1.5}>
              {assets.map((asset) => {
                const collection = assetCollections.find(
                  (item) => item.public_id === asset.collection_id,
                );
                return (
                  <Grid key={asset.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <AssetCard
                      asset={asset}
                      actions={renderAssetActions?.(asset)}
                      collectionChip={collectionChipFor(
                        collection?.name,
                        collection?.public_id ?? "",
                      )}
                      onClick={() =>
                        onSelectItem({ type: "asset", row: asset })
                      }
                    />
                  </Grid>
                );
              })}
              {assets.length === 0 && (
                <Grid size={12}>
                  <WorkspaceEmptyState
                    icon={<CollectionsIcon />}
                    title="沒有資產"
                    description="這個分類目前沒有資產。"
                  />
                </Grid>
              )}
              {pagination && pagination.count > 1 && (
                <Grid size={12}>
                  <Box
                    sx={{ display: "flex", justifyContent: "center", pt: 1 }}
                  >
                    <Pagination
                      count={pagination.count}
                      page={pagination.page}
                      onChange={(_, page) => pagination.onChange(page)}
                      color="primary"
                    />
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </>
      )}
    </Stack>
  );
}

function WorkspaceEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{
        minHeight: 180,
        mt: 1,
        px: 3,
        py: 4,
        border: 1,
        borderStyle: "dashed",
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#3a3a3a" : "#dedbd3",
        borderRadius: 1,
        color: "text.secondary",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha("#ffffff", 0.018)
            : alpha("#37352f", 0.025),
      }}
    >
      <Box sx={{ color: "primary.main", opacity: 0.64, lineHeight: 0 }}>
        {icon}
      </Box>
      <Typography fontWeight={800} color="text.primary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}
