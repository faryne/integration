import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import axios from "axios";
import { useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useStorytellerAsset,
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
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  WorkspaceMobileNav,
  WorkspacePane,
  WorkspaceSidebar,
} from "./ProjectWorkspacePreviewComponents.tsx";
import { useWorkspaceListActions } from "./ProjectWorkspacePreviewActions.tsx";
import { WorkspaceAssetPanel } from "./ProjectWorkspacePreviewRows.tsx";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import StorytellerImageEpisodeEditor from "./ImageEpisodeEditor.tsx";
import StorytellerLoreEditor from "./LoreEditor.tsx";
import StorytellerNewProject from "./NewProject.tsx";
import StorytellerStoryEditor from "./StoryEditor.tsx";
import {
  backendUncategorizedFilterId,
  nodeTitle,
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import {
  EditorBleedContainer,
  WorkspaceBleedContainer,
  WorkspaceCentered,
  WorkspaceChrome,
} from "./WorkspaceChrome.tsx";
import { hasUnsavedWorkspaceChanges } from "./WorkspaceLeaveGuard.ts";

const storyPageSize = 20;
const lorePageSize = 20;
const assetPageSize = 24;

export default function StorytellerProjectWorkspacePreview() {
  const { id, storyId, loreId, assetId, collectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [storyPage, setStoryPage] = useState(1);
  const [lorePage, setLorePage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [assetKeyword, setAssetKeyword] = useState("");
  // 整個側邊欄（不是個別分組）的收合開關，給螢幕較窄或想專心看右欄內容時用。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // App 內離開編輯器前的確認——「回列表」按鈕跟側邊欄切換分組都會先呼叫
  // guardedNavigate，有未存檔變更時先把實際要執行的動作存起來、彈出確認對話框，
  // 使用者按「離開」才真的執行；沒有未存檔變更（或不在編輯器內）就直接放行，
  // 不會多一次確認的打斷。
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

  function guardedNavigate(action: () => void) {
    if (hasUnsavedWorkspaceChanges()) {
      setPendingNavigation(() => action);
      return;
    }
    action();
  }

  const routeEditorType = location.pathname.includes("/image/")
    ? "image"
    : location.pathname.includes("/story/")
      ? "story"
      : location.pathname.includes("/lore/")
        ? "lore"
        : location.pathname.includes("/asset/")
          ? "asset"
          : // 「編輯專案」表單（my/workspace/:id/edit）沒有分組概念，跟其他編輯器
            // 路由不同不是靠 /xxx/:id 這種形狀分辨，直接看網址結尾是不是 /edit。
            location.pathname.endsWith("/edit")
            ? "edit"
            : "";
  const isEditProjectRoute = routeEditorType === "edit";
  const isNewStoryRoute = storyId === "new" && routeEditorType === "story";
  const isNewImageRoute = storyId === "new" && routeEditorType === "image";
  // 故事／圖像／設定集都不用先從列表裡找到對應資料列才能決定要渲染哪個編輯器——
  // 路徑本身（/story|image|lore/）就已經決定好要開哪個編輯器，直接把 id 原樣交給
  // 對應的編輯器元件處理；元件自己會用 apiStory/apiLore 找不找得到資料判斷是不是
  // 新建，找不到又不是新建時也是元件自己回傳 <ErrorPage code={404} />，不用在
  // 這裡先做一次「找不到就不渲染」的守門，不然反而會讓編輯器內建的 404 處理
  // 永遠沒有機會執行（只會安靜地顯示空白，這是原本的 bug）。
  const isExistingStoryRoute =
    Boolean(storyId) && storyId !== "new" && routeEditorType === "story";
  const isExistingImageRoute =
    Boolean(storyId) && storyId !== "new" && routeEditorType === "image";
  const isLoreRoute = Boolean(loreId) && routeEditorType === "lore";
  // 資產沒有獨立的「新建」空白編輯頁（資產本來就是上傳建立），所以只有編輯既有
  // 資產這一種情況需要路由，直接用資產 id 換真正的資產資料（見下面 routeAssetQuery）。
  const isAssetRoute = Boolean(assetId) && routeEditorType === "asset";
  // 側邊欄目前選到哪個分組／收藏集要能被 URL 完整表示，重新整理或直接貼連結都要
  // 還原到同一個畫面。瀏覽路由（/stories|lores|assets(/:collectionId)?）直接從
  // 網址參數還原；故事/圖像/設定集/資產編輯器路由本身不帶分組資訊（網址是
  // /story|image|lore|asset/:xxxId），改用開啟編輯器當下附加的 ?from= 查詢參數記住
  // 「使用者是從哪個分組點進來的」，讓側邊欄高亮、麵包屑、「回列表」在編輯畫面
  // 底下都還能正確對應，不需要额外的 state 或依賴瀏覽器歷史記錄。
  const browsingSection: WorkspaceSection = location.pathname.includes("/lores")
    ? "lores"
    : location.pathname.includes("/assets")
      ? "assets"
      : "stories";
  // 「編輯專案」是專案層級的操作，跟作品／設定集／資產集三個分組完全無關——
  // 不能落進下面故事/設定集/資產編輯器共用的「回推屬於哪個分組」邏輯，不然會
  // 因為 collectionId 剛好都是空字串，被 SidebarGroup 誤判成「目前選到全部作品」，
  // 連帶把不相干的那一列也一起反白。塞一個不會撞到任何真實 id 的哨兵值，確保
  // 編輯專案時三個分組都不會被誤選。
  const selected: SelectedNode = isEditProjectRoute
    ? { section: "stories", collectionId: "__project_edit__" }
    : routeEditorType
      ? {
          section:
            routeEditorType === "lore"
              ? "lores"
              : routeEditorType === "asset"
                ? "assets"
                : "stories",
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
    selected.collectionId === ungroupedId
      ? backendUncategorizedFilterId
      : selected.collectionId,
    lorePage,
    lorePageSize,
  );
  const assetsQuery = useStorytellerAssets(
    selected.section === "assets" ? id : undefined,
    assetPage,
    assetPageSize,
    assetKeyword,
    selected.collectionId === ungroupedId
      ? backendUncategorizedFilterId
      : selected.collectionId,
  );
  const routeAssetQuery = useStorytellerAsset(
    id,
    isAssetRoute ? assetId : undefined,
  );

  const stories = storiesQuery.data ?? [];
  const volumes = volumesQuery.data ?? [];
  const loreCollections = loreCollectionsQuery.data ?? [];
  const assetCollections = assetCollectionsQuery.data ?? [];
  const project = projectQuery.data;
  // 故事／圖像／設定集／資產編輯器（不管是編輯既有作品還是「新建」）在右欄要出血
  // 滿版顯示，不能跟列表頁共用中間那圈 maxWidth+置中的窄欄容器——那是給列表閱讀
  // 用的排版，編輯器需要盡量用滿右欄寬度才有 Notion 風工作台的感覺。
  const showBleedEditor =
    isNewStoryRoute ||
    isNewImageRoute ||
    isExistingStoryRoute ||
    isExistingImageRoute ||
    isLoreRoute ||
    isAssetRoute ||
    isEditProjectRoute;

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
  // 網址上帶的 collectionId 是「全部」「未分冊/未分類」以外的具體值時，要確認
  // 那個冊/分類/資產集真的存在——不然貼一個打錯字或已經被刪除的 id 進網址，
  // 畫面只會安靜地顯示「沒有作品」，看起來像是那個冊本來就是空的，而不是這個
  // 冊根本不存在。等對應的分組清單載入完成才判斷，避免清單還沒回來時被誤判。
  const activeCollections =
    selected.section === "stories"
      ? volumes
      : selected.section === "lores"
        ? loreCollections
        : assetCollections;
  const activeCollectionsLoading =
    selected.section === "stories"
      ? volumesQuery.isLoading
      : selected.section === "lores"
        ? loreCollectionsQuery.isLoading
        : assetCollectionsQuery.isLoading;
  const isSpecialCollectionId =
    selected.collectionId === "" || selected.collectionId === ungroupedId;
  const isUnknownCollection =
    !isSpecialCollectionId &&
    !activeCollectionsLoading &&
    !activeCollections.some(
      (collection) => collection.public_id === selected.collectionId,
    );
  // 右欄的載入/錯誤狀態只看「目前分組實際在用的那個 query」，不是三個 query
  // OR 在一起——不然瀏覽作品時，如果背景的資產 query 剛好出錯，會把整個作品
  // 列表誤判成載入失敗。指定了具體 collectionId 時也要等對應的分組清單一起
  // 載入完，不然還沒判斷出是不是未知冊之前會先閃一下空清單。isError 時進一步
  // 從 axios 錯誤拿出真正的 HTTP 狀態碼，沒有的話（不是 axios 錯誤）退回 500，
  // 交給 <ErrorPage/> 顯示對應文案；「請求成功但真的沒有資料」跟這裡完全無關，
  // 那個情境是 errorCode 維持 undefined，畫面上走 WorkspacePane 自己的
  // 「沒有作品/設定/資產」空狀態。
  const activeListLoading =
    (selected.section === "stories"
      ? storiesQuery.isLoading
      : selected.section === "lores"
        ? loresPageQuery.isLoading
        : assetsQuery.isLoading) ||
    (!isSpecialCollectionId && activeCollectionsLoading);
  const activeListIsError =
    selected.section === "stories"
      ? storiesQuery.isError
      : selected.section === "lores"
        ? loresPageQuery.isError
        : assetsQuery.isError;
  const activeListError =
    selected.section === "stories"
      ? storiesQuery.error
      : selected.section === "lores"
        ? loresPageQuery.error
        : assetsQuery.error;
  // isUnknownCollection 要比原始的 query 錯誤優先判斷——設定集／資產集的清單
  // 是後端依 collectionId 篩選的，帶一個不存在的 id 過去，後端會直接回
  // 400（無效參數），不像作品是純前端用 volumes 清單過濾、後端請求本身不會出錯。
  // 兩種情況使用者看到的都應該是「這個冊/分類找不到」的 404，不是依內部實作
  // 細節而異的 400 或 404 混雜。
  const activeListErrorCode = isUnknownCollection
    ? 404
    : activeListIsError
      ? axios.isAxiosError(activeListError)
        ? (activeListError.response?.status ?? 500)
        : 500
      : undefined;

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
    guardedNavigate(() => {
      setStoryPage(1);
      setLorePage(1);
      setAssetPage(1);
      navigate(steamloomPath(browsingPath(section, targetCollectionId)));
    });
  }

  function openStoryInWorkspace(item: SelectedItem) {
    // 帶上 ?from= 記住目前是從哪個分組點進編輯器——故事/圖像/設定集/資產編輯器的
    // 路由本身不含分組資訊，沒有這個查詢參數的話，編輯畫面底下的側邊欄高亮／
    // 麵包屑／「回列表」都沒辦法對回原本瀏覽的分組。
    const fromSuffix = selected.collectionId
      ? `?from=${encodeURIComponent(selected.collectionId)}`
      : "";
    const segment =
      item.type === "story"
        ? item.row.content_type === "image"
          ? "image"
          : "story"
        : item.type === "lore"
          ? "lore"
          : "asset";
    navigate(
      steamloomPath(
        `my/workspace/${id}/${segment}/${item.row.public_id}${fromSuffix}`,
      ),
    );
  }

  function closeWorkspaceEditor() {
    guardedNavigate(() => {
      // 「編輯專案」的 selected 是特地塞進去、不對應任何真實分組的哨兵值
      // （見上面 selected 的說明），不能拿去餵 browsingPath——那樣會被誤判成
      // 「有指定 collectionId」，兜出一個根本不存在的分組網址。直接回專案首頁。
      navigate(
        steamloomPath(
          isEditProjectRoute
            ? `my/workspace/${id}`
            : browsingPath(selected.section, selected.collectionId),
        ),
      );
    });
  }

  // 故事/圖像/設定集編輯器自己會呼叫 useTitle 設定更精確的標題（存檔後的故事標題
  // 之類），這裡的標題主要是給「列表瀏覽」跟「資產面板」（資產沒有獨立頁面元件，
  // 不會自己設標題）用；編輯器路由掛載時兩邊都會各自呼叫一次 useTitle，但子元件
  // 的 effect 先跑，之後只要子元件的標題相關資料一變動就會重新蓋回正確標題，
  // 不會卡住停在這裡設的通用標題。
  const workspaceTitleContext =
    isAssetRoute && routeAssetQuery.data
      ? storytellerAssetTitle(routeAssetQuery.data)
      : collectionBreadcrumbLabel === "全部"
        ? sectionBreadcrumbLabel
        : `${collectionBreadcrumbLabel} · ${sectionBreadcrumbLabel}`;
  const workspaceTitle = project?.name
    ? `${workspaceTitleContext} - ${project.name}`
    : workspaceTitleContext;
  useTitle(`${workspaceTitle} - ${STORYTELLER_APP_NAME}`, {
    path: id
      ? steamloomPath(browsingPath(selected.section, selected.collectionId))
      : undefined,
    robots: "noindex, nofollow",
  });

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
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: sidebarCollapsed
              ? "36px minmax(0, 1fr)"
              : "260px minmax(0, 1fr)",
          },
          flex: 1,
          minHeight: 0,
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        }}
      >
        {!isMobile && (
          // 外層不能有 overflow:hidden——收合按鈕要浮貼在邊界上，剛好卡在側邊欄
          // 跟右欄內容的交界，如果 overflow:hidden 套在同一層，按鈕負值定位的
          // 部分會直接被裁掉（之前的版本就是這樣被切成一半的怪形狀）。真正需要
          // 裁切捲軸的 overflow:hidden 只留給裡面包側邊欄內容的那一層。
          <Box sx={{ position: "relative", minHeight: 0 }}>
            <Box
              sx={{
                height: "100%",
                borderRight: 1,
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {!sidebarCollapsed && (
                <WorkspaceSidebar
                  project={project}
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
            </Box>
            <Tooltip title={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}>
              <IconButton
                size="small"
                onClick={() => setSidebarCollapsed((value) => !value)}
                sx={{
                  position: "absolute",
                  top: 12,
                  right: -13,
                  zIndex: 2,
                  width: 26,
                  height: 26,
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: (theme) =>
                    theme.palette.mode === "dark" ? "#3a3a3a" : "#d8d5cd",
                  "&:hover": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8",
                  },
                }}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <ChevronLeftIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        <Box sx={{ minWidth: 0, overflow: "auto" }}>
          {isMobile && (
            <WorkspaceMobileNav
              project={project}
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
              {isEditProjectRoute ? (
                <StorytellerNewProject embedded />
              ) : isNewStoryRoute ? (
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
              ) : isExistingImageRoute ? (
                <StorytellerImageEpisodeEditor
                  embedded
                  projectId={id}
                  episodePublicId={storyId}
                />
              ) : isExistingStoryRoute ? (
                <StorytellerStoryEditor
                  embedded
                  projectId={id}
                  storyPublicId={storyId}
                />
              ) : isAssetRoute && routeAssetQuery.data ? (
                <WorkspaceAssetPanel
                  asset={routeAssetQuery.data}
                  assetCollections={assetCollections}
                  projectId={id ?? ""}
                  onDeleted={closeWorkspaceEditor}
                />
              ) : isAssetRoute && routeAssetQuery.isLoading ? (
                <WorkspaceCentered>
                  <CircularProgress size={24} />
                  <Typography color="text.secondary">載入資產中...</Typography>
                </WorkspaceCentered>
              ) : isAssetRoute ? (
                <ErrorPage
                  compact
                  backUrl={steamloomPath(
                    browsingPath(selected.section, selected.collectionId),
                  )}
                  code={
                    axios.isAxiosError(routeAssetQuery.error)
                      ? (routeAssetQuery.error.response?.status ?? 404)
                      : 404
                  }
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
                volumes={volumes}
                loreCollections={loreCollections}
                assetCollections={assetCollections}
                loading={activeListLoading}
                errorCode={activeListErrorCode}
                errorBackUrl={steamloomPath(`my/workspace/${id}`)}
                onSelectItem={openStoryInWorkspace}
                onSelectCollection={(collectionId) =>
                  selectNode(selected.section, collectionId)
                }
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
      <Dialog
        open={pendingNavigation !== null}
        onClose={() => setPendingNavigation(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>你有尚未儲存的變更</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            離開這個編輯畫面後，還沒存檔的變更會遺失，確定要離開嗎？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingNavigation(null)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              pendingNavigation?.();
              setPendingNavigation(null);
            }}
          >
            離開
          </Button>
        </DialogActions>
      </Dialog>
    </WorkspaceChrome>
  );
}
