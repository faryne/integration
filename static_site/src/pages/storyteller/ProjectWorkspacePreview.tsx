import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import {
  Box,
  Button,
  CircularProgress,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useStorytellerAssetCollections,
  useStorytellerAssets,
  useStorytellerLoreCollections,
  useStorytellerLoresPage,
  useStorytellerProject,
  useStorytellerProjects,
  useStorytellerStories,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  WorkspaceMobileNav,
  WorkspacePane,
  WorkspaceSidebar,
} from "./ProjectWorkspacePreviewComponents.tsx";
import { useWorkspaceListActions } from "./ProjectWorkspacePreviewActions.tsx";
import { WorkspaceAssetPanel } from "./ProjectWorkspacePreviewRows.tsx";
import StorytellerImageEpisodeEditor from "./ImageEpisodeEditor.tsx";
import StorytellerLoreEditor from "./LoreEditor.tsx";
import StorytellerStoryEditor from "./StoryEditor.tsx";
import {
  nodeTitle,
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";

const storyPageSize = 20;
const lorePageSize = 20;
const assetPageSize = 24;

export default function StorytellerProjectWorkspacePreview() {
  const { id, storyId, loreId, collectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [storyPage, setStoryPage] = useState(1);
  const [lorePage, setLorePage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [assetKeyword, setAssetKeyword] = useState("");

  const routeEditorType = location.pathname.includes("/image/")
    ? "image"
    : location.pathname.includes("/story/")
      ? "story"
      : location.pathname.includes("/lore/")
        ? "lore"
        : "";
  const isNewStoryRoute = storyId === "new" && routeEditorType === "story";
  const isNewImageRoute = storyId === "new" && routeEditorType === "image";
  // 設定集不用像故事/圖像那樣先從列表裡找到對應資料列才能決定要渲染哪個編輯器——
  // 路徑本身（/lore/）就已經決定好要開 LoreEditor，新建（loreId=new）跟編輯既有
  // 設定集（loreId=真正的 public_id）都直接把 loreId 原樣交給 LoreEditor 處理，
  // 它自己會用 lorePublicId === "new" 判斷是不是新建。
  const isLoreRoute = Boolean(loreId) && routeEditorType === "lore";
  // 側邊欄目前選到哪個分組／收藏集要能被 URL 完整表示，重新整理或直接貼連結都要
  // 還原到同一個畫面。瀏覽路由（/stories|lores|assets(/:collectionId)?）直接從
  // 網址參數還原；故事/圖像/設定集編輯器路由本身不帶分組資訊（網址是
  // /story|image|lore/:xxxId），改用開啟編輯器當下附加的 ?from= 查詢參數記住
  // 「使用者是從哪個分組點進來的」，讓側邊欄高亮、麵包屑、「回列表」在編輯畫面
  // 底下都還能正確對應，不需要额外的 state 或依賴瀏覽器歷史記錄。
  const browsingSection: WorkspaceSection = location.pathname.includes("/lores")
    ? "lores"
    : location.pathname.includes("/assets")
      ? "assets"
      : "stories";
  const selected: SelectedNode = routeEditorType
    ? {
        section: routeEditorType === "lore" ? "lores" : "stories",
        collectionId: searchParams.get("from") ?? "",
      }
    : { section: browsingSection, collectionId: collectionId ?? "" };

  const projectQuery = useStorytellerProject(id);
  const projectsQuery = useStorytellerProjects();
  const storiesQuery = useStorytellerStories(id);
  const volumesQuery = useStorytellerVolumes(id);
  const loreCollectionsQuery = useStorytellerLoreCollections(id);
  const assetCollectionsQuery = useStorytellerAssetCollections(id);
  const loresPageQuery = useStorytellerLoresPage(
    selected.section === "lores" ? id : undefined,
    selected.collectionId === ungroupedId ? "" : selected.collectionId,
    lorePage,
    lorePageSize,
  );
  const assetsQuery = useStorytellerAssets(
    selected.section === "assets" ? id : undefined,
    assetPage,
    assetPageSize,
    assetKeyword,
    selected.collectionId === ungroupedId ? "" : selected.collectionId,
  );

  const stories = storiesQuery.data ?? [];
  const volumes = volumesQuery.data ?? [];
  const loreCollections = loreCollectionsQuery.data ?? [];
  const assetCollections = assetCollectionsQuery.data ?? [];
  const project = projectQuery.data;
  const routeStory =
    storyId && storyId !== "new"
      ? stories.find((story) => !story.is_volume && story.public_id === storyId)
      : undefined;
  const routeSelectedItem: SelectedItem | null =
    routeStory && routeEditorType
      ? { type: "story", row: routeStory }
      : selectedItem;
  // 故事／圖像／設定集編輯器（不管是編輯既有作品還是「新建」）在右欄要出血滿版顯示，
  // 不能跟列表頁共用中間那圈 maxWidth+置中的窄欄容器——那是給列表閱讀用的排版，編輯器
  // 需要盡量用滿右欄寬度才有 Notion 風工作台的感覺。
  const showBleedEditor =
    isNewStoryRoute ||
    isNewImageRoute ||
    isLoreRoute ||
    routeSelectedItem?.type === "story" ||
    routeSelectedItem?.type === "asset";

  const storyRows = useMemo(() => {
    const parentId =
      selected.collectionId && selected.collectionId !== ungroupedId
        ? volumes.find((volume) => volume.public_id === selected.collectionId)
            ?.id
        : null;
    return stories
      .filter((story) => !story.is_volume)
      .filter((story) => {
        if (selected.section !== "stories" || selected.collectionId === "") {
          return true;
        }
        return selected.collectionId === ungroupedId
          ? story.parent_id === null
          : story.parent_id === parentId;
      })
      .sort((left, right) => left.sort - right.sort);
  }, [selected, stories, volumes]);
  const storyTotalPages = Math.max(
    1,
    Math.ceil(storyRows.length / storyPageSize),
  );
  const visibleStoryRows = storyRows.slice(
    (storyPage - 1) * storyPageSize,
    storyPage * storyPageSize,
  );
  // 拖曳排序只在「單一分組」且沒有分頁時開放——「全部作品」混雜多個冊/未分冊、
  // 又沒有像舊版管理頁那樣攤開所有分組的視覺分隔，拖曳語意不明確；筆數超過一頁
  // 也沒辦法用原生 HTML5 拖放跨頁搬動，乾脆只在同一頁看得到整組時才開放。
  const canReorderStories =
    selected.section === "stories" &&
    selected.collectionId !== "" &&
    storyTotalPages <= 1;
  const loreTotalPages = Math.max(
    1,
    Math.ceil((loresPageQuery.data?.total_count ?? 0) / lorePageSize),
  );
  const assetTotalPages = Math.max(
    1,
    Math.ceil((assetsQuery.data?.total_count ?? 0) / assetPageSize),
  );

  const activeTitle =
    nodeTitle(selected.section, selected.collectionId) ||
    volumes.find((volume) => volume.public_id === selected.collectionId)
      ?.title ||
    loreCollections.find(
      (collection) => collection.public_id === selected.collectionId,
    )?.name ||
    assetCollections.find(
      (collection) => collection.public_id === selected.collectionId,
    )?.name ||
    "工作台";
  // 麵包屑最後兩段要跟著目前選到的分組／收藏集走：「作品/設定集/資產集」＋
  // 「冊標題｜未分冊｜未分類｜全部」，跟左側側邊欄、右欄標題呈現的是同一組資訊，
  // 只是縮寫成更適合塞進麵包屑的短字串（不重複「全部作品」這種完整敘述）。
  const sectionBreadcrumbLabel =
    selected.section === "stories"
      ? "作品"
      : selected.section === "lores"
        ? "設定集"
        : "資產集";
  const collectionBreadcrumbLabel =
    selected.collectionId === ""
      ? "全部"
      : selected.collectionId === ungroupedId
        ? selected.section === "stories"
          ? "未分冊"
          : "未分類"
        : (volumes.find((volume) => volume.public_id === selected.collectionId)
            ?.title ??
          loreCollections.find(
            (collection) => collection.public_id === selected.collectionId,
          )?.name ??
          assetCollections.find(
            (collection) => collection.public_id === selected.collectionId,
          )?.name ??
          "");

  // 把「分組＋收藏集」換算成瀏覽路由：沒有 collectionId 時，作品區用裸路徑
  // （既有連結大量指向 my/workspace/:id，維持相容），設定集／資產集區則是
  // /lores、/assets（沒有對應的「裸路徑」慣例，直接用分組名稱）。
  function browsingPath(section: WorkspaceSection, targetCollectionId: string) {
    if (!targetCollectionId) {
      return section === "stories"
        ? `my/workspace/${id}`
        : `my/workspace/${id}/${section}`;
    }
    return `my/workspace/${id}/${section}/${targetCollectionId}`;
  }

  function selectNode(section: WorkspaceSection, targetCollectionId: string) {
    setSelectedItem(null);
    setStoryPage(1);
    setLorePage(1);
    setAssetPage(1);
    navigate(steamloomPath(browsingPath(section, targetCollectionId)));
  }

  function openStoryInWorkspace(item: SelectedItem) {
    // 帶上 ?from= 記住目前是從哪個分組點進編輯器——故事/圖像/設定集編輯器的路由
    // 本身不含分組資訊，沒有這個查詢參數的話，編輯畫面底下的側邊欄高亮／麵包屑／
    // 「回列表」都沒辦法對回原本瀏覽的分組。
    const fromSuffix = selected.collectionId
      ? `?from=${encodeURIComponent(selected.collectionId)}`
      : "";
    if (item.type === "story") {
      const segment = item.row.content_type === "image" ? "image" : "story";
      navigate(
        steamloomPath(
          `my/workspace/${id}/${segment}/${item.row.public_id}${fromSuffix}`,
        ),
      );
      return;
    }
    if (item.type === "lore") {
      navigate(
        steamloomPath(
          `my/workspace/${id}/lore/${item.row.public_id}${fromSuffix}`,
        ),
      );
      return;
    }
    setSelectedItem(item);
  }

  function closeWorkspaceEditor() {
    setSelectedItem(null);
    navigate(
      steamloomPath(browsingPath(selected.section, selected.collectionId)),
    );
  }

  const listActions = useWorkspaceListActions({
    projectId: id,
    selected,
    stories,
    volumes,
    loreCollections,
    assetCollections,
    assetKeyword,
    onAssetKeywordChange: (keyword) => {
      setAssetKeyword(keyword);
      setAssetPage(1);
    },
    onSelect: selectNode,
    onRefreshAssets: () => void assetsQuery.refetch(),
  });

  if (authLoading) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <CircularProgress size={24} />
          <Typography color="text.secondary">確認登入狀態...</Typography>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }
  if (!session) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <AutoStoriesIcon color="primary" />
          <Box>
            <Typography fontWeight={900}>需要登入</Typography>
            <Typography variant="body2" color="text.secondary">
              登入後才能預覽專案工作台。
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => void login()}>
            {submitting ? "登入中" : "使用 Google 登入"}
          </Button>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }
  if (projectQuery.isLoading) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <CircularProgress size={24} />
          <Typography color="text.secondary">載入工作台...</Typography>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }

  return (
    <WorkspaceChrome
      title={project?.name ?? "專案"}
      projectId={project?.public_id ?? id}
      projects={projectsQuery.data ?? []}
      trail={[sectionBreadcrumbLabel, collectionBreadcrumbLabel]}
      action={
        <Button component={RouterLink} to={steamloomPath(`my/project/${id}`)}>
          舊管理頁
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" },
          flex: 1,
          minHeight: 0,
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              borderRight: 1,
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <WorkspaceSidebar
              selected={selected}
              stories={stories}
              volumes={volumes}
              loreCollections={loreCollections}
              assetCollections={assetCollections}
              onSelect={selectNode}
              onCreateVolume={listActions.onCreateVolume}
              onCreateLoreCollection={listActions.onCreateLoreCollection}
              onCreateAssetCollection={listActions.onCreateAssetCollection}
              onReorderVolume={listActions.reorderVolume}
            />
          </Box>
        )}
        <Box sx={{ minWidth: 0, overflow: "auto" }}>
          {isMobile && (
            <WorkspaceMobileNav
              selected={selected}
              stories={stories}
              volumes={volumes}
              loreCollections={loreCollections}
              assetCollections={assetCollections}
              onSelect={selectNode}
              onCreateVolume={listActions.onCreateVolume}
              onCreateLoreCollection={listActions.onCreateLoreCollection}
              onCreateAssetCollection={listActions.onCreateAssetCollection}
              onReorderVolume={listActions.reorderVolume}
            />
          )}
          {showBleedEditor ? (
            <EditorBleedContainer onBack={closeWorkspaceEditor}>
              {isNewStoryRoute ? (
                <StorytellerStoryEditor
                  embedded
                  projectId={id}
                  storyPublicId="new"
                />
              ) : isNewImageRoute ? (
                <StorytellerImageEpisodeEditor
                  embedded
                  projectId={id}
                  episodePublicId="new"
                />
              ) : isLoreRoute ? (
                <StorytellerLoreEditor
                  embedded
                  projectId={id}
                  lorePublicId={loreId}
                />
              ) : routeSelectedItem?.type === "story" &&
                routeSelectedItem.row.content_type === "image" ? (
                <StorytellerImageEpisodeEditor
                  embedded
                  projectId={id}
                  episodePublicId={routeSelectedItem.row.public_id}
                />
              ) : routeSelectedItem?.type === "story" ? (
                <StorytellerStoryEditor
                  embedded
                  projectId={id}
                  storyPublicId={routeSelectedItem.row.public_id}
                />
              ) : routeSelectedItem?.type === "asset" ? (
                <WorkspaceAssetPanel
                  asset={routeSelectedItem.row}
                  assetCollections={assetCollections}
                  projectId={id ?? ""}
                  onDeleted={closeWorkspaceEditor}
                />
              ) : null}
            </EditorBleedContainer>
          ) : (
            <WorkspaceBleedContainer>
              <WorkspacePane
                title={activeTitle}
                selected={selected}
                stories={visibleStoryRows}
                lores={loresPageQuery.data?.lores ?? []}
                assets={assetsQuery.data?.assets ?? []}
                loading={
                  storiesQuery.isLoading ||
                  loresPageQuery.isLoading ||
                  assetsQuery.isLoading
                }
                onSelectItem={openStoryInWorkspace}
                actions={listActions.actions}
                titleActions={listActions.titleActions}
                pagination={
                  selected.section === "stories"
                    ? {
                        count: storyTotalPages,
                        page: Math.min(storyPage, storyTotalPages),
                        onChange: setStoryPage,
                      }
                    : selected.section === "lores"
                      ? {
                          count: loreTotalPages,
                          page: Math.min(lorePage, loreTotalPages),
                          onChange: setLorePage,
                        }
                      : {
                          count: assetTotalPages,
                          page: Math.min(assetPage, assetTotalPages),
                          onChange: setAssetPage,
                        }
                }
                renderStoryActions={listActions.renderStoryActions}
                renderLoreActions={listActions.renderLoreActions}
                renderAssetActions={listActions.renderAssetActions}
                onReorderStory={
                  canReorderStories ? listActions.reorderStory : undefined
                }
              />
            </WorkspaceBleedContainer>
          )}
        </Box>
      </Box>
      {listActions.dialogs}
    </WorkspaceChrome>
  );
}

function WorkspaceChrome({
  title,
  projectId,
  projects = [],
  trail = [],
  action,
  children,
}: {
  title: string;
  projectId?: string;
  projects?: Array<{
    public_id: string;
    name: string;
    slug: string;
    updated_at: string;
  }>;
  // 麵包屑接在專案名稱後面的其餘段落，例如 ["作品", "桌布集"]——由呼叫端依目前
  // 選到的分組／收藏集組好，這裡只負責照順序插上分隔符號渲染。
  trail?: string[];
  action?: ReactNode;
  children: ReactNode;
}) {
  const [projectMenuAnchor, setProjectMenuAnchor] =
    useState<HTMLElement | null>(null);
  const switchableProjects = projects.filter(
    (project) => project.public_id !== projectId,
  );

  function closeProjectMenu() {
    setProjectMenuAnchor(null);
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: { xs: 56, sm: 64 },
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: (theme) => theme.zIndex.drawer,
        display: "flex",
        flexDirection: "column",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        color: (theme) =>
          theme.palette.mode === "dark" ? "#f1f1f0" : "#37352f",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 0.75,
          minHeight: 44,
          borderBottom: 1,
          borderColor: (theme) =>
            theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha("#191919", 0.96)
              : alpha("#ffffff", 0.96),
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            minWidth: 0,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* 窄螢幕優先讓「目前選到哪個分組/收藏集」有空間顯示，站名跟「我的工作台」
              這兩段先收起來——真的還是放不下時，整條麵包屑本身可以橫向捲動（見外層
              overflowX），文字內容永遠不會被硬擠到看不見。 */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0 }}
          >
            <Typography
              component={RouterLink}
              to={steamloomPath()}
              color="text.secondary"
              sx={{ textDecoration: "none", flexShrink: 0 }}
            >
              {STORYTELLER_APP_NAME}
            </Typography>
            <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
              &gt;
            </Typography>
            <Typography
              component={RouterLink}
              to={steamloomPath("my")}
              color="text.secondary"
              sx={{ textDecoration: "none", flexShrink: 0 }}
            >
              我的工作台
            </Typography>
            <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
              &gt;
            </Typography>
          </Stack>
          <Stack
            component={RouterLink}
            to={projectId ? steamloomPath(`my/workspace/${projectId}`) : "#"}
            direction="row"
            alignItems="center"
            spacing={0.25}
            onClick={(event) => {
              if (switchableProjects.length > 0) {
                event.preventDefault();
                setProjectMenuAnchor((current) =>
                  current ? null : event.currentTarget,
                );
              }
            }}
            sx={{
              flexShrink: 0,
              color: "primary.main",
              textDecoration: "none",
              fontWeight: 800,
              "&:hover": { color: "primary.dark" },
            }}
          >
            <Typography fontWeight={800} noWrap>
              {title}
            </Typography>
            <Typography
              component="span"
              color="text.secondary"
              sx={{ lineHeight: 1 }}
            >
              ▾
            </Typography>
          </Stack>
          {trail
            .filter((segment) => segment)
            .map((segment, index) => (
              <Stack
                key={index}
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{ flexShrink: 0 }}
              >
                <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
                  &gt;
                </Typography>
                <Typography color="text.secondary" noWrap>
                  {segment}
                </Typography>
              </Stack>
            ))}
        </Stack>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      <Menu
        anchorEl={projectMenuAnchor}
        open={Boolean(projectMenuAnchor)}
        onClose={closeProjectMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableAutoFocusItem
        MenuListProps={{ dense: true }}
        slotProps={{
          paper: {
            sx: { minWidth: 240, maxWidth: 360 },
          },
        }}
      >
        {switchableProjects.length === 0 ? (
          <MenuItem disabled>沒有其他專案</MenuItem>
        ) : (
          switchableProjects.map((project) => (
            <MenuItem
              key={project.public_id}
              component={RouterLink}
              to={steamloomPath(`my/workspace/${project.public_id}`)}
              onClick={closeProjectMenu}
              sx={{
                borderBottom: 1,
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
                py: 1,
              }}
            >
              <ListItemText
                primary={project.name}
                secondary={`最後更新 ${formatStorytellerDate(project.updated_at)}`}
                primaryTypographyProps={{ noWrap: true }}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </MenuItem>
          ))
        )}
      </Menu>
      {children}
    </Box>
  );
}

// 右欄的出血容器——不管是列表還是編輯器都用滿欄寬，不像舊版那樣置中收窄成一欄
// 文章排版，只留最基本的內距讓內容不會貼齊邊框。
function WorkspaceBleedContainer({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 } }}>{children}</Box>
  );
}

// 編輯器（既有作品或新建）額外在最上面放「回列表」，用帶圖示的膠囊按鈕取代純文字
// 連結——編輯器內容本身很大一片，純文字連結太不顯眼，容易讓人找不到返回的路。
function EditorBleedContainer({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <WorkspaceBleedContainer>
      <Stack spacing={2}>
        <Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={onBack}
            sx={{
              borderRadius: 999,
              px: 1.5,
              color: "text.secondary",
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#3a3a3a" : "#d8d5cd",
              "&:hover": {
                color: "primary.main",
                borderColor: "primary.main",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            回列表
          </Button>
        </Box>
        {children}
      </Stack>
    </WorkspaceBleedContainer>
  );
}

function WorkspaceCentered({ children }: { children: ReactNode }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      textAlign="center"
      sx={{ minHeight: "calc(100vh - 150px)", p: 3 }}
    >
      {children}
    </Stack>
  );
}
