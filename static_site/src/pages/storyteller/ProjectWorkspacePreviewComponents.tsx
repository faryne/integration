import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Pagination,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useDeleteStorytellerProject } from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { storytellerReaderPath } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import { LoreRow, StoryRow } from "./WorkspaceDocumentRows.tsx";
import { AssetCard } from "./WorkspaceAssetPanel.tsx";
import { SidebarGroup } from "./ProjectWorkspaceSidebarTree.tsx";
import type { RenderSidebarItemActions } from "./ProjectWorkspaceSidebarTreeChildren.tsx";
import {
  workspaceToolPages,
  type WorkspaceToolPage,
} from "./workspaceToolPages.tsx";
import { useWorkspaceViewMode } from "./workspaceViewMode.ts";
import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { WorkspaceSearchField } from "./WorkspaceSearchField.tsx";
import type {
  StorytellerAsset,
  StorytellerLore,
  StorytellerProject,
  StorytellerStory,
} from "@/types/storyteller.ts";

export interface WorkspaceSidebarProps {
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
  onSelectItem: (item: SelectedItem, collectionId: string) => void;
  selectedItem?: { type: SelectedItem["type"]; publicId: string };
  onCreateVolume?: () => void;
  onCreateLoreCollection?: () => void;
  onCreateAssetCollection?: () => void;
  onReorderVolume?: (draggedId: string, beforeId: string | null) => void;
  onReorderLoreCollection?: (
    draggedId: string,
    beforeId: string | null,
  ) => void;
  // 側邊列排序模式下，同一冊內的作品上移／下移
  onReorderStoryInVolume?: (
    collectionId: string,
    draggedId: string,
    beforeId: string | null,
  ) => void;
  // 側邊列每篇作品／設定 hover 時的 ⋮，跟列表打開同一份選單
  renderItemActions?: RenderSidebarItemActions;
  onNavigate?: () => void;
  // 目前開啟的專案層工具頁（梭梭的記憶、稽核紀錄）；見 workspaceToolPages。
  activeToolPage?: WorkspaceToolPage;
  onOpenToolPage?: (page: WorkspaceToolPage) => void;
  // 側欄頂端搜尋框送出時呼叫；手機 drawer 會先經過 onNavigate 收起再開搜尋對話框。
  onSearch?: (keyword: string) => void;
}

export function WorkspaceSidebar({
  project,
  selected,
  stories,
  volumes,
  loreCollections,
  assetCollections,
  onSelect,
  onSelectItem,
  selectedItem,
  onCreateVolume,
  onCreateLoreCollection,
  onCreateAssetCollection,
  onReorderVolume,
  onReorderLoreCollection,
  onReorderStoryInVolume,
  renderItemActions,
  onNavigate,
  activeToolPage,
  onOpenToolPage,
  onSearch,
}: WorkspaceSidebarProps) {
  const { t } = useTranslation();
  const storiesByCollection = useMemo(() => {
    const grouped = new Map<string, StorytellerStory[]>();
    const volumeIds = new Map(volumes.map((volume) => [volume.id, volume]));
    grouped.set(ungroupedId, []);
    volumes.forEach((volume) => grouped.set(volume.public_id, []));
    stories
      .filter((story) => !story.is_volume)
      .forEach((story) => {
        const key =
          story.parent_id === null
            ? ungroupedId
            : volumeIds.get(story.parent_id)?.public_id;
        if (key) {
          grouped.set(key, [...(grouped.get(key) ?? []), story]);
        }
      });
    grouped.forEach((rows) =>
      rows.sort((left, right) => left.sort - right.sort),
    );
    return grouped;
  }, [stories, volumes]);
  const storyCount = stories.filter((story) => !story.is_volume).length;
  const ungroupedStoryCount = stories.filter(
    (story) => !story.is_volume && story.parent_id === null,
  ).length;
  return (
    <Stack sx={{ height: 1, color: "text.secondary" }}>
      {onSearch && (
        <WorkspaceSearchField
          onSubmit={(keyword) => {
            onNavigate?.();
            onSearch(keyword);
          }}
        />
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1, pb: 0 }}>
        <SidebarGroup
          title={t("web.projectWorkspace.tabs.stories")}
          section="stories"
          icon={<AutoStoriesIcon fontSize="small" />}
          selected={selected}
          rows={[
            {
              id: "",
              label: t("web.workspacePreview.allWorks"),
              count: storyCount,
            },
            {
              id: ungroupedId,
              label: t("web.projectWorkspace.volume.ungrouped"),
              count: ungroupedStoryCount,
              stories: storiesByCollection.get(ungroupedId) ?? [],
            },
            ...volumes.map((volume) => ({
              id: volume.public_id,
              label: volume.title,
              count: stories.filter((story) => story.parent_id === volume.id)
                .length,
              stories: storiesByCollection.get(volume.public_id) ?? [],
            })),
          ]}
          onSelect={onSelect}
          onSelectItem={onSelectItem}
          selectedItem={selectedItem}
          onCreate={onCreateVolume}
          createLabel={t("web.projectWorkspace.volume.add")}
          onReorder={onReorderVolume}
          onReorderItem={onReorderStoryInVolume}
          renderItemActions={renderItemActions}
        />
        <SidebarGroup
          title={t("web.projectWorkspace.tabs.lores")}
          section="lores"
          icon={<SettingsIcon fontSize="small" />}
          projectPublicId={project?.public_id}
          selected={selected}
          rows={[
            {
              id: "",
              label: t("web.workspacePreview.allLore"),
              count: project?.lore_count,
            },
            {
              id: ungroupedId,
              label: t("web.loreManager.uncategorized"),
              count: project?.lore_uncategorized_count,
            },
            ...loreCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.lore_count,
            })),
          ]}
          onSelect={onSelect}
          onSelectItem={onSelectItem}
          selectedItem={selectedItem}
          onCreate={onCreateLoreCollection}
          onReorder={onReorderLoreCollection}
          renderItemActions={renderItemActions}
        />
        <SidebarGroup
          title={t("web.projectWorkspace.tabs.assets")}
          section="assets"
          icon={<CollectionsIcon fontSize="small" />}
          projectPublicId={project?.public_id}
          selected={selected}
          rows={[
            {
              id: "",
              label: t("web.workspacePreview.allAssets"),
              count: project?.asset_count,
            },
            {
              id: ungroupedId,
              label: t("web.assetManager.uncategorized"),
              count: project?.asset_uncategorized_count,
            },
            ...assetCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.asset_count,
            })),
          ]}
          onSelect={onSelect}
          onSelectItem={onSelectItem}
          selectedItem={selectedItem}
          onCreate={onCreateAssetCollection}
        />
        {onOpenToolPage &&
          workspaceToolPages.map((page) => (
            <ListItemButton
              key={page.key}
              selected={activeToolPage === page.key}
              onClick={() => {
                onOpenToolPage(page.key);
                onNavigate?.();
              }}
              sx={{ borderRadius: 1, mx: 0.5, mb: 1 }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 32,
                  color:
                    activeToolPage === page.key ? "primary.main" : "inherit",
                }}
              >
                {page.icon("small")}
              </ListItemIcon>
              <ListItemText
                primary={t(page.labelKey)}
                primaryTypographyProps={{ fontWeight: 800, fontSize: 13 }}
              />
            </ListItemButton>
          ))}
      </Box>
      {project && (
        <ProjectActionsGroup project={project} onNavigate={onNavigate} />
      )}
    </Stack>
  );
}

// 專案層級操作固定在 navigator 底部，不跟會捲動的冊／設定集混在一起；mobile
// Drawer 與 desktop sidebar 共用這一區。
function ProjectActionsGroup({
  project,
  onNavigate,
}: {
  project: StorytellerProject;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
    <Box
      sx={{
        flexShrink: 0,
        p: 1,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "transparent",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ display: "block", px: 1, pb: 0.5 }}
      >
        {t("web.workspacePreview.projectActions")}
      </Typography>
      <List dense disablePadding>
        <ListItemButton
          component={RouterLink}
          to={steamloomPath(`my/workspace/${project.public_id}/edit`)}
          onClick={onNavigate}
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
            primary={t("web.projectWorkspace.editProject")}
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
          onClick={onNavigate}
          sx={sidebarActionRowSx}
        >
          <ListItemIcon sx={{ minWidth: 26 }}>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("web.workspacePreview.openReader")}
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
            primary={t("web.projectWorkspace.deleteProject")}
            primaryTypographyProps={{
              fontWeight: 700,
              noWrap: true,
              fontSize: 13,
            }}
          />
        </ListItemButton>
      </List>
      <StorytellerConfirmNameDialog
        open={deleteOpen}
        title={t("web.projectWorkspace.deleteProject")}
        description={t("web.projectWorkspace.deleteProjectDescription")}
        confirmName={project.name}
        confirmLabel={t("web.projectWorkspace.deleteProject")}
        loading={deleteProject.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteProject.mutate(project.public_id, {
            onSuccess: () => navigate(steamloomPath("my/projects")),
            onError: () =>
              setDeleteError(t("web.projectWorkspace.errors.projectDelete")),
          })
        }
      />
      <CustomSnackbar
        open={Boolean(deleteError)}
        message={deleteError}
        severity="error"
        onClose={() => setDeleteError("")}
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
    bgcolor: "action.hover",
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
  const { t } = useTranslation();
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const { viewMode, setViewMode } = useWorkspaceViewMode(selected.section);
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
            {t("web.workspacePreview.workspaceStatus", {
              status: loading
                ? t("web.workspacePreview.syncing")
                : t("web.workspacePreview.itemCount", { count }),
            })}
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
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={viewMode}
            onChange={(_, value) => value && setViewMode(value)}
            aria-label={t("web.workspacePreview.switchView")}
          >
            <ToggleButton
              value="grid"
              aria-label={t("web.workspacePreview.gridView")}
              title={t("web.workspacePreview.gridView")}
            >
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="list"
              aria-label={t("web.workspacePreview.listView")}
              title={t("web.workspacePreview.listView")}
            >
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
        </Stack>
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
            <Box
              sx={
                viewMode === "grid"
                  ? {
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }
                  : undefined
              }
            >
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
                    reorderable={viewMode === "list" && Boolean(onReorderStory)}
                    dragging={draggingStoryId === story.public_id}
                    onDragStart={() => setDraggingStoryId(story.public_id)}
                    onDropRow={() => {
                      if (draggingStoryId) {
                        onReorderStory?.(draggingStoryId, story.public_id);
                      }
                      setDraggingStoryId(null);
                    }}
                    viewMode={viewMode}
                  />
                );
              })}
              {viewMode === "list" && onReorderStory && stories.length > 0 && (
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
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <WorkspaceEmptyState
                    icon={<ArticleIcon />}
                    title={t("web.workspacePreview.emptyWorks")}
                    description={t("web.workspacePreview.emptyWorksDescription")}
                  />
                </Box>
              )}
              {pagination && pagination.count > 1 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    pt: 1.5,
                    gridColumn: "1 / -1",
                  }}
                >
                  <Pagination
                    count={pagination.count}
                    page={pagination.page}
                    onChange={(_, page) => pagination.onChange(page)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          )}
          {selected.section === "lores" && (
            <Box
              sx={
                viewMode === "grid"
                  ? {
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                        xl: "repeat(3, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }
                  : undefined
              }
            >
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
                    viewMode={viewMode}
                  />
                );
              })}
              {lores.length === 0 && (
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <WorkspaceEmptyState
                    icon={<DescriptionIcon />}
                    title={t("web.workspacePreview.emptyLore")}
                    description={t("web.workspacePreview.emptyLoreDescription")}
                  />
                </Box>
              )}
              {pagination && pagination.count > 1 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    pt: 1.5,
                    gridColumn: "1 / -1",
                  }}
                >
                  <Pagination
                    count={pagination.count}
                    page={pagination.page}
                    onChange={(_, page) => pagination.onChange(page)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          )}
          {selected.section === "assets" && (
            <Grid container spacing={1.5}>
              {assets.map((asset) => {
                const collection = assetCollections.find(
                  (item) => item.public_id === asset.collection_id,
                );
                return (
                  <Grid
                    key={asset.public_id}
                    size={viewMode === "grid" ? { xs: 12, sm: 6, lg: 4 } : 12}
                  >
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
                      viewMode={viewMode}
                    />
                  </Grid>
                );
              })}
              {assets.length === 0 && (
                <Grid size={12}>
                  <WorkspaceEmptyState
                    icon={<CollectionsIcon />}
                    title={t("web.workspacePreview.emptyAssets")}
                    description={t("web.workspacePreview.emptyAssetsDescription")}
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
