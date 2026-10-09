import type { StorytellerReadingTargetType } from "@/apis/storyteller.ts";
import { ReaderLoreLinkProvider } from "@/pages/storyteller/ReaderLoreLinks.tsx";
import {
  spoilerLockHint,
  useLoreSpoilerGate,
} from "@/pages/storyteller/useLoreSpoilerGate.ts";
import {
  useCreateStorytellerStoryBookmark,
  useDeleteStorytellerStoryBookmark,
  usePublicStorytellerImageStoryPages,
  usePublicStorytellerProject,
  usePublicStorytellerStoryLatestVersion,
  usePublicStorytellerStoryVersions,
  useSaveStorytellerProjectFavorite,
  useSaveStorytellerProjectRanking,
  useSharedStorytellerImageStoryPages,
  useSharedStorytellerProject,
  useStorytellerProject,
  useStorytellerProjectBookmarks,
  useStorytellerProjectFavorite,
  useStorytellerProjectRanking,
  useStorytellerStoryBookmarks,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { formatAuthorNames } from "@/helpers/storytellerAuthors.ts";
import {
  storytellerCoverObjectPosition,
  useGatedCoverUrl,
} from "@/helpers/storytellerCover.ts";
import {
  readerDiscussionsPath,
  readerLorePath,
  readerLoresPath,
  readerProjectBasePath,
  readerShareBasePath,
  readerStoryPath,
} from "@/helpers/storytellerReaderPaths.ts";
import { useTitle } from "@/helpers/title.tsx";
import { useStorytellerHeaderContext } from "@/layouts/StorytellerHeaderContext.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { FollowAuthorButton } from "@/pages/storyteller/FollowAuthorButton.tsx";
import { ContentMetaHeader } from "@/pages/storyteller/ReaderContentHeader.tsx";
import { ImagePageScrubber } from "@/pages/storyteller/ReaderImagePageScrubber.tsx";
import { ReaderIndexPanel } from "@/pages/storyteller/ReaderIndexPanel.tsx";
import { ReaderLorePage } from "@/pages/storyteller/ReaderLorePage.tsx";
import type {
  BookmarkMode,
  ReaderImagePage,
  ReaderProject,
  StoryHeading,
} from "@/pages/storyteller/readerModel.ts";
import {
  extractStoryHeadings,
  readerLoreGroupAnchorId,
  readerLoresFromProject,
  type ReaderLandingTab,
} from "@/pages/storyteller/readerModel.ts";
import {
  ReaderTextFrame,
  StoryContentLines,
} from "@/pages/storyteller/ReaderStoryContent.tsx";
import { ReaderWorkLanding } from "@/pages/storyteller/ReaderWorkLanding.tsx";
import { buildReaderDiscussion } from "@/pages/storyteller/readerDiscussion.ts";
import { ReaderDiscussionBoard } from "@/components/storyteller/discussion/ReaderDiscussionBoard.tsx";
import { ReaderDiscussionButton } from "@/components/storyteller/discussion/ReaderDiscussionButton.tsx";
import { readingTargetKey } from "@/pages/storyteller/readingRecordStore.ts";
import { StorytellerReaderHistory } from "@/pages/storyteller/StorytellerReaderHistory.tsx";
import { StorytellerReaderToolbar } from "@/pages/storyteller/StorytellerReaderToolbar.tsx";
import { ReaderReportButton } from "@/components/storyteller/report/ReaderReportButton.tsx";
import { ReportMenuButton } from "@/components/storyteller/report/ReportMenuButton.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import { flattenGroupedStories } from "@/pages/storyteller/storytellerVolumes.ts";
import {
  StorytellerFootnoteSection,
  StorytellerWysiwygMarkdown,
} from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  useReadingRecords,
  useSettledReadingProgress,
} from "@/pages/storyteller/useReadingRecords.ts";
import {
  readerScrollableRange,
  useReadingResume,
} from "@/pages/storyteller/useReadingResume.ts";
import { useStorytellerReaderPreferences } from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";
import { computeFootnoteNumbering } from "@/pages/storyteller/wysiwygCore/parser.ts";
import type { StorytellerStoryBookmarkWithStory } from "@/types/storyteller.ts";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArticleIcon from "@mui/icons-material/Article";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  Drawer,
  GlobalStyles,
  IconButton,
  Paper,
  Rating,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useId, useRef, useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

// 閱讀 context 已合併進全站 AppBar，不再另外疊第二列；跳轉時只需避開 Header。
const READER_STICKY_OFFSET = 84;

// 設定頁的閱讀列用詞：設定不是章節，上一則／下一則只在設定之間切換
const LORE_TOOLBAR_LABELS = {
  previous: "上一則",
  next: "下一則",
  navigation: "設定列表",
  navigationTooltip: "回到設定列表",
};

// landingTab 由路由決定：work/:projectPath 是故事 Tab，/lores 是設定 Tab，/discussions 是討論 Tab
export default function StorytellerReader({
  landingTab = "stories",
}: {
  landingTab?: ReaderLandingTab;
}) {
  const { setReader: setHeaderReader } = useStorytellerHeaderContext();
  const { session, loading: authLoading } = useAuth();
  const params = useParams();
  const location = useLocation();
  const { shareToken } = params;
  const routeItemId = params.itemId;
  const routeLoreId = params.loreId;
  const routeProjectPath = params.projectPath;
  const consumedImageHashRef = useRef<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  // 目前這張圖是否已經載入完成——圖片頁切換時（換頁或換話）重置，載入完成前顯示
  // loading，避免容器高度因為圖片還沒下載完、瀏覽器抓不到尺寸而跳動。
  const [currentPageLoaded, setCurrentPageLoaded] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [bookmarkEditing, setBookmarkEditing] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [readerContextVisible, setReaderContextVisible] = useState(false);
  // 本文容器用 state 當 callback ref：直接開網址時容器會比進度 effect 晚掛上（例如還在等登入
  // 狀態），用 useRef 的話 effect 拿到 null 就不會再重跑，閱讀進度永遠停在 0%
  const [readerBodyNode, setReaderBodyNode] = useState<HTMLDivElement | null>(
    null,
  );
  const { preferences, updatePreferences } = useStorytellerReaderPreferences();
  const [favorite, setFavorite] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [pendingBookmarkLines, setPendingBookmarkLines] = useState<Set<number>>(
    new Set(),
  );
  const [pendingImageBookmarkPages, setPendingImageBookmarkPages] = useState<
    Set<string>
  >(new Set());
  const [bookmarkSnackbar, setBookmarkSnackbar] = useState<{
    open: boolean;
    message: string;
    severity?: "success" | "error";
  }>({ open: false, message: "" });
  // block 依呼叫端而不同：書籤沿用原本的 "center"（把整行捲到畫面中央方便看上下文）；
  // 標題跳轉用 "start"，讓標題落在畫面頂端的「目前閱讀行」附近，跟下面 scroll-spy
  // 判斷目前 highlight 哪個標題所用的基準線一致，不然點擊當下跟捲動結束後兩邊算出來的
  // 「目前標題」對不上，畫面會在跳轉完成的瞬間又跳回上一個標題。
  const [pendingScroll, setPendingScroll] = useState<
    { lineIndex: number; block: ScrollLogicalPosition } | undefined
  >(undefined);
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>(
    undefined,
  );
  // 側欄「本篇大綱」目前 highlight 哪個標題，由下面的捲動監聽隨捲動更新。
  const [activeHeadingLine, setActiveHeadingLine] = useState<
    number | undefined
  >(undefined);
  const [historicalVersionId, setHistoricalVersionId] = useState<
    number | undefined
  >(undefined);
  const navigate = useNavigate();
  const contentTitleRef = useRef<HTMLHeadingElement | null>(null);
  const previousItemIdRef = useRef<string | undefined>(undefined);
  const routeProjectPublicId = routeProjectPath?.split("-", 1)[0];
  const publicProjectQuery = usePublicStorytellerProject(routeProjectPath);
  const sharedProjectQuery = useSharedStorytellerProject(shareToken);
  const shouldLoadOwnerProject = Boolean(
    routeProjectPublicId &&
    !shareToken &&
    session?.encrypt_key &&
    !publicProjectQuery.isLoading &&
    !publicProjectQuery.data,
  );
  const ownerProjectQuery = useStorytellerProject(
    shouldLoadOwnerProject ? routeProjectPublicId : undefined,
  );
  const ownerPrivateProject =
    ownerProjectQuery.data?.visibility === "private"
      ? ownerProjectQuery.data
      : undefined;
  const apiProject = routeProjectPath
    ? (publicProjectQuery.data ?? ownerPrivateProject)
    : shareToken
      ? sharedProjectQuery.data
      : undefined;
  const isOwner = Boolean(apiProject?.is_owner);
  // 限制級專案要有年齡確認 cookie 才顯示封面（放在提早 return 之前，符合 hooks 規則）
  const gatedCoverUrl = useGatedCoverUrl(
    apiProject?.cover_url,
    apiProject?.rating,
  );
  const favoriteQuery = useStorytellerProjectFavorite(
    isOwner ? undefined : apiProject?.public_id,
  );
  const saveFavorite = useSaveStorytellerProjectFavorite(
    isOwner ? undefined : apiProject?.public_id,
  );
  const rankingQuery = useStorytellerProjectRanking(
    isOwner ? undefined : apiProject?.public_id,
  );
  const saveRanking = useSaveStorytellerProjectRanking(
    isOwner ? undefined : apiProject?.public_id,
  );
  const isFavorited = apiProject
    ? (favoriteQuery.data?.favorited ?? false)
    : favorite;
  const rating = rankingQuery.data?.ranking ?? null;
  const project: ReaderProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
        path: readerProjectBasePath(
          `${apiProject.public_id}-${apiProject.slug}`,
        ),
        authors: (apiProject.authors ?? []).map((author) => ({
          pen_name: author.pen_name,
          follower_count: author.follower_count,
        })),
        authorPenNames: formatAuthorNames(apiProject.authors)
          ? formatAuthorNames(apiProject.authors).split("、")
          : [],
        rating: apiProject.rating,
        tags: apiProject.tags ?? [],
        coverUrl: gatedCoverUrl,
        coverLayout: apiProject.cover_layout ?? "split",
        coverFocalPoint: apiProject.cover_focal_point ?? { x: 0.5, y: 0.32 },
        wordCount: (apiProject.stories ?? []).reduce(
          (total, story) => total + story.word_count,
          0,
        ),
        items: flattenGroupedStories(
          apiProject.stories ?? [],
          apiProject.volumes ?? [],
        ).map((story) => ({
          id: story.public_id,
          contentType: story.content_type,
          title: story.title,
          summary: story.summary,
          content: story.latest_content,
          sort: story.sort,
          updatedAt: story.updated_at,
          parentId: story.parent_id,
          authorPenNames:
            (story.authors ?? [])
              .map((author) => author.pen_name)
              .filter(Boolean) || [],
        })),
        volumes: [...(apiProject.volumes ?? [])]
          .sort((left, right) => left.sort - right.sort)
          .map((volume) => ({ id: volume.id, title: volume.title })),
        ...readerLoresFromProject(apiProject),
      }
    : undefined;
  const items = project?.items ?? [];
  const volumes = project?.volumes ?? [];
  const loreOrder = project?.loreOrder ?? [];
  // 設定頁：網址帶 loreId 時顯示單則設定；上一則／下一則依設定 Tab 的列表順序
  const currentLoreIndex = routeLoreId
    ? loreOrder.findIndex((lore) => lore.id === routeLoreId)
    : -1;
  const currentLore =
    currentLoreIndex >= 0 ? loreOrder[currentLoreIndex] : undefined;
  // 故事與話已經合併成同一份依序排列的序列，網址也統一只帶 itemId；沒有 itemId
  // 就是「作品首頁」，顯示封面、簡介與章節目錄，點目錄或「開始閱讀」才進入 Reader。
  const currentItemId = routeItemId;
  const currentItem = currentItemId
    ? items.find((item) => item.id === currentItemId)
    : undefined;
  const currentItemIndex = currentItem
    ? items.findIndex((item) => item.id === currentItem.id)
    : -1;
  const previousItem =
    currentItemIndex > 0 ? items[currentItemIndex - 1] : undefined;
  const nextItem =
    currentItemIndex >= 0 && currentItemIndex < items.length - 1
      ? items[currentItemIndex + 1]
      : undefined;
  const currentStory =
    currentItem?.contentType === "text" ? currentItem : undefined;
  const currentEpisode =
    currentItem?.contentType === "image" ? currentItem : undefined;
  useEffect(() => {
    setHeaderReader(
      project && currentItem
        ? {
            projectName: project.name,
            title: currentItem.title,
            summary: currentItem.summary || undefined,
            coverUrl: gatedCoverUrl,
            coverLayout: project.coverLayout,
            coverFocalPoint: project.coverFocalPoint,
            visible: readerContextVisible,
          }
        : undefined,
    );
  }, [
    currentItem?.id,
    currentItem?.summary,
    currentItem?.title,
    project?.name,
    project?.coverLayout,
    // 依賴拆成 x/y 兩個原始值，而不是 project.coverFocalPoint 這個物件——project 每次
    // render 都是重新組出來的新物件參考，直接放物件當依賴會讓這個 effect 每次都重跑。
    project?.coverFocalPoint.x,
    project?.coverFocalPoint.y,
    gatedCoverUrl,
    readerContextVisible,
    setHeaderReader,
  ]);
  useEffect(() => () => setHeaderReader(undefined), [setHeaderReader]);
  // 圖像頁只在真的打開某一話時才抓，不在專案列表層級一次抓所有話——跟專案本身的
  // owner／public／shared 三種讀取路徑對稱（見上面 apiProject 的組法）。
  const publicImagePagesQuery = usePublicStorytellerImageStoryPages(
    !shareToken ? routeProjectPath : undefined,
    !shareToken ? currentEpisode?.id : undefined,
  );
  const sharedImagePagesQuery = useSharedStorytellerImageStoryPages(
    shareToken,
    currentEpisode?.id,
  );
  const apiEpisodePages = shareToken
    ? sharedImagePagesQuery.data
    : publicImagePagesQuery.data;
  const currentEpisodePages: ReaderImagePage[] = (apiEpisodePages ?? []).map(
    (page) => ({
      id: page.id,
      imageUrl: page.image_url,
      description: page.description,
    }),
  );
  const totalEpisodePages = currentEpisodePages.length;
  const latestVersionQuery = usePublicStorytellerStoryLatestVersion(
    apiProject?.public_id,
    currentStory?.id,
  );
  const versionsQuery = usePublicStorytellerStoryVersions(
    apiProject?.public_id,
    currentStory?.id,
  );
  // 文字／圖片書籤共用同一張表、同一組 API——不管 currentItem 是故事還是話，都用同一份
  // query／mutation，靠 line_id（文字存行號字串、圖片存頁面 id）與 story_version_id
  // （只有文字書籤會填）分辨用途，不需要為圖片書籤另外開一組 hook。
  const bookmarksQuery = useStorytellerStoryBookmarks(
    apiProject?.public_id,
    currentItem?.id,
  );
  const createBookmark = useCreateStorytellerStoryBookmark(
    apiProject?.public_id,
    currentItem?.id,
  );
  // 刪除不像建立那樣綁定「目前正在看的這篇作品」——書籤側欄要能刪專案裡任何一篇
  // 作品的書籤（例如清掉別篇已經失效的舊書籤），所以 storyPublicId 是每次呼叫
  // mutate() 時才帶，不是 hook 建構參數。
  const deleteBookmark = useDeleteStorytellerStoryBookmark(
    apiProject?.public_id,
  );
  const [pendingDeleteBookmarkIds, setPendingDeleteBookmarkIds] = useState<
    Set<number>
  >(new Set());
  const [deleteBookmarkTarget, setDeleteBookmarkTarget] =
    useState<StorytellerStoryBookmarkWithStory | null>(null);
  const latestVersionId = latestVersionQuery.data?.id;
  const versions = versionsQuery.data ?? [];
  const historicalVersionIndex = historicalVersionId
    ? versions.findIndex((version) => version.id === historicalVersionId)
    : -1;
  const historicalVersion =
    historicalVersionIndex >= 0 ? versions[historicalVersionIndex] : undefined;
  const isHistoricalView = Boolean(historicalVersion);
  const displayVersionId = historicalVersion
    ? historicalVersion.id
    : latestVersionId;
  const displayContent = historicalVersion
    ? historicalVersion.content
    : currentStory?.content;
  // 閱讀進度：文字看捲動位置、圖像看翻到第幾頁；看歷史版本時不記錄（那不是正式內容），
  // 數值要穩定一段時間才寫入，換篇瞬間的暫態值不會被誤記（見 useSettledReadingProgress）
  const readingRecords = useReadingRecords(apiProject?.public_id);
  // 防劇透：鎖住的設定不顯示內容、標題換成替代標題，也不記錄閱讀進度（確認卡片不算讀過）
  const spoilerGate = useLoreSpoilerGate(
    apiProject?.public_id,
    readingRecords.progressMap,
  );
  const currentLoreLocked = currentLore
    ? spoilerGate.isLocked(currentLore)
    : false;
  const currentReadingProgress = isHistoricalView
    ? null
    : currentStory
      ? readingProgress
      : currentEpisode && totalEpisodePages > 0
        ? Math.round(((pageIndex + 1) / totalEpisodePages) * 100)
        : null;
  // 設定頁也記錄閱讀進度（同一套捲動公式），key 帶種類前綴才分得出是故事還是設定
  useSettledReadingProgress(
    currentItem
      ? readingTargetKey("story", currentItem.id)
      : currentLore
        ? readingTargetKey("lore", currentLore.id)
        : undefined,
    currentItem
      ? currentReadingProgress
      : currentLore && !currentLoreLocked
        ? readingProgress
        : null,
    (key, progress) => {
      const [type, publicId] = key.split(":") as [
        StorytellerReadingTargetType,
        string,
      ];
      readingRecords.report(type, publicId, progress);
    },
  );
  const readingResume = useReadingResume({
    itemId: currentItem?.id,
    isImage: Boolean(currentEpisode),
    ready: readingRecords.ready,
    progress: currentItem
      ? readingRecords.storyProgress(currentItem.id)
      : undefined,
    skip: Boolean(location.hash) || isHistoricalView,
    bodyNode: readerBodyNode,
    totalPages: totalEpisodePages,
    setPageIndex,
  });
  // 腳注編號／尾端清單一定要用「整篇故事的完整內容」算一次，不能讓下面逐行渲染的
  // StoryContentLines 每行各自算——不然每行都會從編號 1 重來，且腳注只要出現在某行，
  // 那行就會各自渲染一次尾端清單（腳注應該只在整篇故事最尾端出現一次，跟內容裡有沒有
  // 標題、標題怎麼分段完全無關）。footnoteIdPrefix 也要在這裡算一次，跟逐行渲染的每個
  // StorytellerWysiwygMarkdown 實例、跟故事最尾端的 StorytellerFootnoteSection 共用
  // 同一個值，上標編號連結才能正確跳轉。
  const footnoteIdPrefix = useId();
  const footnoteNumbering = computeFootnoteNumbering(displayContent ?? "");
  // React Compiler 會自動處理記憶化，這裡不用手動包 useMemo（見專案 vite.config.ts 的
  // babel-plugin-react-compiler 設定）。
  const storyHeadings = extractStoryHeadings(displayContent ?? "");
  const bookmarkedLines = new Set(
    (bookmarksQuery.data ?? [])
      .filter((bookmark) => bookmark.story_version_id === displayVersionId)
      .map((bookmark) => Number(bookmark.line_id)),
  );
  const bookmarkMode: BookmarkMode = isHistoricalView
    ? "removeOnly"
    : displayVersionId
      ? "full"
      : "none";
  // groupIndex 是 StoryContentLines 分組後、這一組第一行的原始行號（見該元件開頭的
  // 說明）——存進 API 的 lineId 因此不再是「使用者點的那一行」，而是「使用者點的那一組
  // 的錨點行」；一般段落/標題本來就是單行一組，行為跟以前沒有差別，差別只在引用/清單/
  // 表格這類會合併成一組的情況。
  const handleToggleBookmark = (groupIndex: number) => {
    if (!session) {
      setLoginPromptOpen(true);
      return;
    }
    if (
      !displayVersionId ||
      !currentItem ||
      pendingBookmarkLines.has(groupIndex)
    ) {
      return;
    }
    const isBookmarked = bookmarkedLines.has(groupIndex);
    if (isHistoricalView && !isBookmarked) {
      return;
    }
    setPendingBookmarkLines((prev) => new Set(prev).add(groupIndex));
    const lineId = String(groupIndex);
    const mutationOptions = {
      onSuccess: () => {
        setBookmarkSnackbar({
          open: true,
          message: isBookmarked ? "書籤已刪除" : "書籤已加入",
        });
      },
      onError: () =>
        setBookmarkSnackbar({
          open: true,
          message: "書籤更新失敗，請重試。",
          severity: "error",
        }),
      onSettled: () => {
        setPendingBookmarkLines((prev) => {
          const next = new Set(prev);
          next.delete(groupIndex);
          return next;
        });
      },
    };
    if (isBookmarked) {
      deleteBookmark.mutate(
        { storyPublicId: currentItem.id, versionId: displayVersionId, lineId },
        mutationOptions,
      );
    } else {
      createBookmark.mutate(
        { versionId: displayVersionId, lineId },
        mutationOptions,
      );
    }
  };
  const projectBookmarksQuery = useStorytellerProjectBookmarks(
    apiProject?.public_id,
  );
  const projectBookmarks = projectBookmarksQuery.data ?? [];
  // 圖片書籤沒有 story_version_id（不綁版本）——用這個分辨 bookmarksQuery 裡哪些
  // 屬於目前這話的圖片書籤，line_id 就是頁面 id。
  const bookmarkedPageIds = new Set(
    (bookmarksQuery.data ?? [])
      .filter((bookmark) => bookmark.story_version_id == null)
      .map((bookmark) => bookmark.line_id),
  );
  const handleToggleImageBookmark = (pageId: string) => {
    if (!session) {
      setLoginPromptOpen(true);
      return;
    }
    if (!currentItem || pendingImageBookmarkPages.has(pageId)) {
      return;
    }
    const isBookmarked = bookmarkedPageIds.has(pageId);
    setPendingImageBookmarkPages((prev) => new Set(prev).add(pageId));
    const mutationOptions = {
      onSuccess: () => {
        setBookmarkSnackbar({
          open: true,
          message: isBookmarked ? "書籤已刪除" : "書籤已加入",
        });
      },
      onError: () =>
        setBookmarkSnackbar({
          open: true,
          message: "書籤更新失敗，請重試。",
          severity: "error",
        }),
      onSettled: () => {
        setPendingImageBookmarkPages((prev) => {
          const next = new Set(prev);
          next.delete(pageId);
          return next;
        });
      },
    };
    if (isBookmarked) {
      deleteBookmark.mutate(
        { storyPublicId: currentItem.id, lineId: pageId },
        mutationOptions,
      );
    } else {
      createBookmark.mutate({ lineId: pageId }, mutationOptions);
    }
  };
  // 書籤側欄列出的可能是別篇作品的書籤（跟目前開著的 currentItem 無關），所以刪除
  // 用的 storyPublicId／versionId 都要從該筆書籤本身讀，不能沿用上面兩個 handler
  // 綁在目前作品上的邏輯；pending 狀態也要用書籤列自己的 id（跨作品 lineId 可能撞號）。
  const handleDeleteBookmarkFromList = (
    bookmark: StorytellerStoryBookmarkWithStory,
  ) => {
    if (!pendingDeleteBookmarkIds.has(bookmark.id))
      setDeleteBookmarkTarget(bookmark);
  };
  const confirmDeleteBookmarkFromList = () => {
    const bookmark = deleteBookmarkTarget;
    if (!bookmark || pendingDeleteBookmarkIds.has(bookmark.id)) return;
    setPendingDeleteBookmarkIds((prev) => new Set(prev).add(bookmark.id));
    deleteBookmark.mutate(
      {
        storyPublicId: bookmark.story_public_id,
        lineId: bookmark.line_id,
        versionId: bookmark.story_version_id ?? undefined,
      },
      {
        onSuccess: () => {
          setBookmarkSnackbar({ open: true, message: "書籤已刪除" });
          setDeleteBookmarkTarget(null);
        },
        onError: () =>
          setBookmarkSnackbar({
            open: true,
            message: "書籤刪除失敗，請重試。",
            severity: "error",
          }),
        onSettled: () => {
          setPendingDeleteBookmarkIds((prev) => {
            const next = new Set(prev);
            next.delete(bookmark.id);
            return next;
          });
        },
      },
    );
  };
  useEffect(() => {
    setPageIndex(0);
  }, [currentEpisode?.id]);
  useEffect(() => {
    setCurrentPageLoaded(false);
  }, [currentEpisode?.id, pageIndex]);
  useEffect(() => {
    if (!pendingScroll) {
      return;
    }
    const { lineIndex: targetIndex, block } = pendingScroll;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`bookmark-line-${targetIndex}`);
      el?.scrollIntoView({ behavior: "smooth", block });
      setHighlightedLine(targetIndex);
      setPendingScroll(undefined);
      setTimeout(() => setHighlightedLine(undefined), 1200);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentStory?.id, pendingScroll]);
  // 側欄「本篇大綱」捲動高亮：取「目前閱讀行」（畫面頂端往下 sticky offset 處）
  // 之上、最接近的那個標題當作目前段落。
  //
  // 這裡刻意不用 IntersectionObserver：標題之間常常隔著幾千字的正文，偵測區只佔畫面
  // 一小塊，快速捲動（滑鼠滾輪、觸控板甩動）很容易讓標題整個「跳過」偵測區——上一次
  // callback 標題還在偵測區下方，下一次已經在上方，中間那次「進入」的瞬間沒有任何一次
  // 取樣真的落在偵測區內，於是完全沒觸發、highlight 就卡住不動，直到捲到下一個標題才會
  // 「追上」。改成每次捲動都直接重新量測所有標題目前的實際位置，就不會有這種取樣漏接
  // 的問題。
  //
  // 依賴項刻意用 join 後的字串而不是 storyHeadings 陣列本身——storyHeadings 每次 render
  // 都是全新陣列參考，直接放進 deps 會讓這個 effect 每次 render 都重新掛一次捲動監聽，
  // 監聽掛上時的初次量測又會觸發 setActiveHeadingLine，形成永遠跑不完的重render迴圈。
  const storyHeadingAnchorIdsKey = storyHeadings
    .map((heading) => heading.anchorId)
    .join(",");
  useEffect(() => {
    if (storyHeadings.length === 0) {
      setActiveHeadingLine(undefined);
      return;
    }
    const elements = storyHeadings
      .map((heading) => ({
        lineIndex: heading.lineIndex,
        el: document.getElementById(heading.anchorId),
      }))
      .filter(
        (item): item is { lineIndex: number; el: HTMLElement } =>
          item.el !== null,
      );
    if (elements.length === 0) {
      return;
    }
    let frame: number | null = null;
    function updateActiveHeading() {
      frame = null;
      let current = elements[0].lineIndex;
      for (const item of elements) {
        if (item.el.getBoundingClientRect().top <= READER_STICKY_OFFSET) {
          current = item.lineIndex;
        } else {
          break;
        }
      }
      setActiveHeadingLine(current);
    }
    function handleScroll() {
      if (frame !== null) {
        return;
      }
      frame = requestAnimationFrame(updateActiveHeading);
    }
    updateActiveHeading();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [currentStory?.id, storyHeadingAnchorIdsKey]);
  const isShareRoute = Boolean(shareToken);
  const isPrivateOwnerRoute =
    isOwner && apiProject?.visibility === "private" && !isShareRoute;
  const shouldUseStorySeo = Boolean(project && !isPrivateOwnerRoute);

  // 網址規則見 helpers/storytellerReaderPaths.ts；canonical 依目前看的是故事、設定或首頁 Tab 決定
  const routeBasePath = routeProjectPath
    ? readerProjectBasePath(routeProjectPath)
    : shareToken
      ? readerShareBasePath(shareToken)
      : "";
  const canonicalPath = !routeBasePath
    ? ""
    : routeItemId
      ? readerStoryPath(routeBasePath, routeItemId)
      : routeLoreId
        ? readerLorePath(routeBasePath, routeLoreId)
        : landingTab === "lores"
          ? readerLoresPath(routeBasePath)
          : landingTab === "discussions"
            ? readerDiscussionsPath(routeBasePath)
            : routeBasePath;
  const pageTitle =
    currentItem?.title ??
    (currentLore ? spoilerGate.displayTitle(currentLore) : undefined);
  useTitle(
    project
      ? `${pageTitle ? `${pageTitle} - ` : ""}${project.name} - ${STORYTELLER_APP_NAME}`
      : STORYTELLER_APP_NAME,
    {
      description: shouldUseStorySeo
        ? ((currentItem?.summary ||
            (currentLoreLocked ? "" : currentLore?.summary) ||
            project?.description) ??
          undefined)
        : undefined,
      path: canonicalPath,
      // 找不到（私人、草稿、失效連結）也要 noindex：Googlebot 走 SPA，不然會被當成 200 的正常頁收錄（soft 404）。
      // 載入中同樣先 noindex，載完會依結果重設。
      robots:
        isShareRoute ||
        isPrivateOwnerRoute ||
        !project ||
        (currentItemId && !currentItem) ||
        (routeLoreId && !currentLore)
          ? "noindex, nofollow"
          : "index, follow",
      type: shouldUseStorySeo ? "article" : "website",
    },
  );

  useEffect(() => {
    if (!currentItem?.id) {
      return;
    }
    if (!previousItemIdRef.current) {
      previousItemIdRef.current = currentItem.id;
      return;
    }
    if (previousItemIdRef.current === currentItem.id) {
      return;
    }

    previousItemIdRef.current = currentItem.id;
    contentTitleRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentItem?.id]);

  // 換篇或切換歷史版本時結束書籤編輯，避免使用者誤以為模式會跨篇保留。
  useEffect(() => {
    setBookmarkEditing(false);
  }, [currentItem?.id, displayVersionId]);

  // 進度只根據本文容器計算；Hero、全站 header/footer 不列入分母。
  useEffect(() => {
    const node = readerBodyNode;
    if (!node) {
      return;
    }
    let frame: number | null = null;
    const updateProgress = () => {
      const { bodyTop, scrollable } = readerScrollableRange(node);
      // 內容短到一個畫面就放得下（不需要捲動）時，打開就等於讀完
      const next =
        scrollable <= 0
          ? 100
          : Math.min(
              100,
              Math.max(0, ((window.scrollY - bodyTop) / scrollable) * 100),
            );
      setReadingProgress(Math.round(next));
      // 頁首本來就有完整標題與摘要；只有它捲到全站 AppBar 後方時才顯示 compact context，
      // 避免剛開頁面就在同一個 viewport 重複三次專案／篇章資訊。
      const titleBottom =
        contentTitleRef.current?.getBoundingClientRect().bottom;
      const appBarBottom = window.innerWidth < 600 ? 60 : 68;
      setReaderContextVisible(
        Boolean(titleBottom && titleBottom <= appBarBottom),
      );
      frame = null;
    };
    const scheduleUpdate = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(node);
    updateProgress();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [
    readerBodyNode,
    currentItem?.id,
    currentLore?.id,
    displayVersionId,
    pageIndex,
    currentPageLoaded,
  ]);

  // 圖像頁的鍵盤左右鍵換頁，操作模式跟 components/common/ImageViewer.tsx 一致：
  // 只在確實看著圖像頁、且不只有一張圖時才綁定；輸入框／可編輯區聚焦時放行給
  // 瀏覽器原生行為，避免使用者在留言或搜尋欄位打字時被攔截方向鍵。
  useEffect(() => {
    if (!currentEpisode || totalEpisodePages <= 1) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPageIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPageIndex((index) => Math.min(index + 1, totalEpisodePages - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentEpisode, totalEpisodePages]);

  // /:itemId#[頁面 id] 圖像深連結：頁面清單載入完成後，找到 hash 對應的頁面
  // 就跳過去；用 consumedImageHashRef 記住「這個 episode + hash 的組合已經處理過」，
  // 避免使用者自己用左右鍵換頁後，同一個 hash 又把畫面搶回去。
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!hash || !currentEpisode || currentEpisodePages.length === 0) {
      return;
    }
    const hashKey = `${currentEpisode.id}#${hash}`;
    if (consumedImageHashRef.current === hashKey) {
      return;
    }
    const targetIndex = currentEpisodePages.findIndex(
      (page) => page.id === hash,
    );
    if (targetIndex >= 0) {
      consumedImageHashRef.current = hashKey;
      setPageIndex(targetIndex);
    }
  }, [location.hash, currentEpisode, currentEpisodePages]);

  if (
    !project &&
    (authLoading ||
      publicProjectQuery.isLoading ||
      sharedProjectQuery.isLoading ||
      ownerProjectQuery.isLoading)
  ) {
    return (
      <StorytellerShell
        title="故事"
        breadcrumbs={[{ label: STORYTELLER_APP_NAME, to: steamloomPath() }]}
      >
        <StorytellerLoading label="正在載入故事..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  // 有帶 itemId 卻找不到內容時不能退回作品首頁，否則失效連結會被偽裝成正常頁面。
  if ((currentItemId && !currentItem) || (routeLoreId && !currentLore)) {
    return <ErrorPage code={404} />;
  }

  const basePath =
    isShareRoute && shareToken ? readerShareBasePath(shareToken) : project.path;
  const projectLandingPath = basePath;
  const loresPath = readerLoresPath(basePath);
  // 討論版：公開與不公開作品才有，私人作品沒有（見 readerDiscussion.ts）
  const discussion =
    apiProject && apiProject.visibility !== "private"
      ? buildReaderDiscussion({
          projectPublicId: apiProject.public_id,
          share: shareToken,
          basePath,
          isOwner,
          items,
          volumes,
          lores: loreOrder,
          storyProgress: readingRecords.storyProgress,
          loreLocked: spoilerGate.isLocked,
          loreTitle: spoilerGate.displayTitle,
        })
      : undefined;
  // 設定頁用：所屬設定集與上一則／下一則（只在設定之間切換，不會跳進故事）
  const currentLoreCollection = currentLore
    ? project.loreGroups.find(
        (group) => group.collection?.id === currentLore.collectionId,
      )?.collection
    : undefined;
  const previousLore =
    currentLoreIndex > 0 ? loreOrder[currentLoreIndex - 1] : undefined;
  const nextLore =
    currentLoreIndex >= 0 ? loreOrder[currentLoreIndex + 1] : undefined;
  function goToImagePage(index: number) {
    setPageIndex(Math.min(Math.max(index, 0), totalEpisodePages - 1));
  }
  // 文字／圖片書籤共用一個入口，依 content_type 分流：文字書籤沿用行內捲動＋版本過期
  // 判斷；圖片書籤把目標頁面 id 放進 hash，不管是不是同一話都直接 navigate——上面的
  // hash 消化 effect 會在頁面清單載入完成後找到對應頁面並跳過去，同一話只是 hash
  // 換了個值，一樣會觸發（因為 effect 依賴 location.hash）。
  const handleJumpToBookmark = (
    bookmark: StorytellerStoryBookmarkWithStory,
  ) => {
    if (bookmark.content_type === "image") {
      if ((bookmark.page_sort ?? -1) < 0) {
        return;
      }
      navigate(
        `${readerStoryPath(basePath, bookmark.story_public_id)}#${encodeURIComponent(bookmark.line_id)}`,
      );
      return;
    }
    const isStale =
      bookmark.story_version_id !== bookmark.latest_story_version_id;
    setHistoricalVersionId(
      isStale ? (bookmark.story_version_id ?? undefined) : undefined,
    );
    setPendingScroll({
      lineIndex: Number(bookmark.line_id),
      block: "center",
    });
    if (bookmark.story_public_id !== currentStory?.id) {
      navigate(readerStoryPath(basePath, bookmark.story_public_id));
    }
  };
  // 標題有自己的錨點 id（見 storyHeadingAnchorId），跟書籤不同，不用透過 pendingScroll
  // 這一層共用狀態繞一圈——直接找到錨點元素捲過去就好。
  const handleJumpToHeading = (heading: StoryHeading) => {
    // 直接樂觀更新，不用等捲動完成後 scroll-spy 自己抓到，點擊當下就先反白。
    setActiveHeadingLine(heading.lineIndex);
    const el = document.getElementById(heading.anchorId);
    if (!el) {
      return;
    }
    // 原本用 scrollIntoView 配 CSS scroll-margin-top 讓標題落在頂端 sticky
    // AppBar 下方，但 AppBar 是 position: sticky（不是 fixed），smooth 捲動
    // 期間跟它互動時，瀏覽器算出來的最終停留位置會比預期多捲過好幾段——實測
    // 只要拿掉 sticky header 就會準。改成自己算目標 scrollY 再用
    // window.scrollTo 捲，就不會受這個互動影響。
    const targetTop =
      el.getBoundingClientRect().top + window.scrollY - READER_STICKY_OFFSET;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
  };
  // 追蹤、作者與評分移到作品資訊浮層；閱讀頁 Hero 只保留作品名稱與 breadcrumb。
  const favoriteCount = apiProject?.favorite_count ?? 0;
  const projectRatingCount = apiProject?.rating_count ?? 0;
  const projectAverageRating = apiProject?.average_rating ?? 0;
  const readerActions = (
    <>
      <Button
        variant={isFavorited ? "contained" : "outlined"}
        startIcon={isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
        disabled={isOwner || saveFavorite.isPending}
        onClick={() => {
          if (!session) {
            setLoginPromptOpen(true);
            return;
          }
          if (apiProject?.public_id) {
            const nextFavorited = !isFavorited;
            saveFavorite.mutate(nextFavorited, {
              onSuccess: () => {
                setBookmarkSnackbar({
                  open: true,
                  message: nextFavorited ? "已追蹤此作品" : "已取消追蹤此作品",
                });
              },
              onError: () =>
                setBookmarkSnackbar({
                  open: true,
                  message: "作品追蹤狀態更新失敗，請重試。",
                  severity: "error",
                }),
            });
            return;
          }
          setFavorite((value) => !value);
        }}
      >
        {isFavorited ? "已追蹤專案" : "追蹤專案"}（{favoriteCount}）
      </Button>
      {project.authors.map((author) => (
        <FollowAuthorButton
          key={author.pen_name}
          penName={author.pen_name}
          followerCount={author.follower_count ?? 0}
          showName
          disabled={isOwner}
          onLoginRequired={() => setLoginPromptOpen(true)}
          onNotify={(message, severity = "success") =>
            setBookmarkSnackbar({
              open: true,
              message,
              severity,
            })
          }
        />
      ))}
      <Paper variant="outlined" sx={{ px: 1.5, py: 0.75, borderRadius: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            評分
          </Typography>
          <Rating
            value={rating}
            precision={0.5}
            disabled={isOwner || saveRanking.isPending}
            onChange={(_, value) => {
              if (!session) {
                setLoginPromptOpen(true);
                return;
              }
              if (apiProject?.public_id && value !== null) {
                saveRanking.mutate(value, {
                  onSuccess: () =>
                    setBookmarkSnackbar({
                      open: true,
                      message: "評分已儲存。",
                    }),
                  onError: () =>
                    setBookmarkSnackbar({
                      open: true,
                      message: "評分儲存失敗，請重試。",
                      severity: "error",
                    }),
                });
              }
            }}
          />
          {projectRatingCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {projectRatingCount} 人・平均 {projectAverageRating.toFixed(1)}
            </Typography>
          )}
        </Stack>
      </Paper>
      {apiProject && !isOwner && (
        <ReportMenuButton
          label="檢舉作品"
          target={{
            type: "project",
            publicId: apiProject.public_id,
            share: shareToken,
            label: `作品《${project.name}》`,
          }}
        />
      )}
    </>
  );
  const projectPrimaryMeta = (
    <>
      <Chip
        label={
          isPrivateOwnerRoute
            ? "私人預覽"
            : isShareRoute
              ? "專用連結"
              : "公開閱讀"
        }
        color={
          isPrivateOwnerRoute ? "default" : isShareRoute ? "warning" : "success"
        }
      />
      {project.authors.map((author) => (
        <Chip
          key={author.pen_name}
          label={`作者 ${author.pen_name}`}
          variant="outlined"
          component={RouterLink}
          to={steamloomPath(`user/${encodeURIComponent(author.pen_name)}`)}
          clickable
        />
      ))}
      <Chip
        label={`${items.filter((item) => item.contentType !== "image").length} 篇故事`}
        variant="outlined"
        icon={<ArticleIcon fontSize="small" />}
      />
      {items.some((item) => item.contentType === "image") && (
        <Chip
          label={`${items.filter((item) => item.contentType === "image").length} 話`}
          variant="outlined"
          icon={<CollectionsIcon fontSize="small" />}
        />
      )}
    </>
  );
  const projectSecondaryMeta = (
    <>
      <Chip label={`${project.wordCount.toLocaleString()} 字`} />
      <Chip
        label={storytellerProjectRatingLabel(project.rating)}
        color={storytellerProjectRatingColor(project.rating)}
        variant="outlined"
      />
      <Box sx={{ flexBasis: "100%" }}>
        <StorytellerTagChips tags={project.tags} sx={{ mt: 1 }} />
      </Box>
      <Box sx={{ flexBasis: "100%" }}>
        <Divider sx={{ my: 1.5 }} />
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          {readerActions}
        </Stack>
      </Box>
    </>
  );
  const showDetailsCover = Boolean(project.coverUrl);
  const projectDetails = (
    <Stack spacing={1.5}>
      {showDetailsCover && (
        <Box
          component="img"
          src={project.coverUrl}
          alt=""
          sx={{
            width: 1,
            aspectRatio: "2 / 1",
            objectFit: "cover",
            objectPosition: storytellerCoverObjectPosition(
              project.coverLayout,
              project.coverFocalPoint,
            ),
            display: "block",
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      )}
      <Box>
        <Typography variant="subtitle1" fontWeight={900}>
          {project.name}
        </Typography>
        {project.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {project.description}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {projectPrimaryMeta}
        {projectSecondaryMeta}
      </Stack>
    </Stack>
  );
  const hasCurrentContent = Boolean(currentStory || currentEpisode);
  const readerBody = (
    <Paper
      ref={setReaderBodyNode}
      variant="outlined"
      sx={{
        p: currentStory ? { xs: 2, sm: 4, md: 6 } : { xs: 2, sm: 3, md: 4 },
        borderRadius: 0,
        borderColor: "divider",
        bgcolor: "background.paper",
        backgroundImage: "none",
        maxWidth: currentStory ? 960 : 1200,
        width: "100%",
        boxSizing: "border-box",
        alignSelf: "center",
        boxShadow: hasCurrentContent
          ? "18px 18px 0 color-mix(in srgb, var(--storyteller-accent-main) 5%, transparent)"
          : "none",
      }}
    >
      {currentEpisode ? (
        <Stack spacing={2}>
          <ContentMetaHeader
            title={currentEpisode.title}
            titleRef={contentTitleRef}
            summary={currentEpisode.summary}
            authorPenNames={
              currentEpisode.authorPenNames.length > 0
                ? currentEpisode.authorPenNames
                : project.authorPenNames
            }
            updatedAt={currentEpisode.updatedAt}
          />
          <Divider />
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontFamily: "monospace" }}
              >
                {String(pageIndex + 1).padStart(3, "0")} /{" "}
                {String(totalEpisodePages).padStart(3, "0")}
              </Typography>
            </Stack>
            <Box
              sx={{
                position: "relative",
                bgcolor: "background.default",
                borderRadius: 1,
                // 外層不再使用卡片邊框，改由 viewer 自己標示淺色或透明圖片的顯示範圍。
                boxShadow: (theme) =>
                  `inset 0 0 0 1px ${theme.palette.divider}`,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // 容器高度固定，不隨圖片原始尺寸撐高／縮小——換頁時畫面才不會跳動。
                height: "min(70vh, 800px)",
              }}
            >
              {!currentPageLoaded && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              )}
              <Box
                component="img"
                // ref 用來處理圖片其實已經在瀏覽器快取裡、掛載當下就已經 complete 的情況——
                // 這種情況下 onLoad 可能不會再觸發，得靠 .complete 補一次判斷。
                ref={(el: HTMLImageElement | null) => {
                  if (el?.complete) {
                    setCurrentPageLoaded(true);
                  }
                }}
                src={currentEpisodePages[pageIndex]?.imageUrl}
                alt={`第 ${pageIndex + 1} 頁`}
                onLoad={() => setCurrentPageLoaded(true)}
                onClick={() => currentPageLoaded && setImageLightboxOpen(true)}
                sx={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  display: currentPageLoaded ? "block" : "none",
                  cursor: currentPageLoaded ? "zoom-in" : "default",
                }}
              />
              {/* 加書籤按鈕刻意做成「浮在圖片右上角、有文字標籤」的樣式，而不是塞在
                  頁碼旁邊的小 icon button——那個位置太不起眼，使用者容易完全沒注意到。
                  這裡疊在圖片本身之上（點圖片會進原圖模式），需要明確給 zIndex 才點得到，
                  按鈕自己的 onClick 也要 stopPropagation，不然點下去會連帶把圖片點開。 */}
              {currentEpisodePages[pageIndex] &&
                (() => {
                  const currentPageId = currentEpisodePages[pageIndex].id;
                  const isBookmarked = bookmarkedPageIds.has(currentPageId);
                  return (
                    <Tooltip title={isBookmarked ? "移除書籤" : "加入書籤"}>
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          zIndex: 2,
                        }}
                      >
                        <Button
                          size="small"
                          variant={isBookmarked ? "contained" : "outlined"}
                          disabled={pendingImageBookmarkPages.has(
                            currentPageId,
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleImageBookmark(currentPageId);
                          }}
                          startIcon={
                            isBookmarked ? (
                              <BookmarkIcon fontSize="small" />
                            ) : (
                              <BookmarkBorderIcon fontSize="small" />
                            )
                          }
                          sx={{
                            backdropFilter: "blur(8px)",
                            fontWeight: 700,
                            color: "#fff",
                            borderColor: "rgba(255,255,255,0.5)",
                            bgcolor: isBookmarked
                              ? "rgba(245, 158, 11, 0.9)"
                              : "rgba(15, 23, 42, 0.55)",
                            "&:hover": {
                              bgcolor: isBookmarked
                                ? "rgba(245, 158, 11, 1)"
                                : "rgba(15, 23, 42, 0.75)",
                              borderColor: "rgba(255,255,255,0.7)",
                            },
                          }}
                        >
                          {isBookmarked ? "已加入書籤" : "加入書籤"}
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })()}
            </Box>
            {/* 原圖模式：點縮小尺寸顯示的圖片會進來這裡，用原始比例（不裁切、不縮放
                塞進固定容器）瀏覽；換頁沿用同一套 goToImagePage，鍵盤左右鍵也共用
                最上層那個 keydown effect，不用在這裡另外接一份。 */}
            <Dialog
              fullScreen
              open={imageLightboxOpen}
              onClose={() => setImageLightboxOpen(false)}
              PaperProps={{ sx: { bgcolor: "#020617", color: "#f8fafc" } }}
            >
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: "rgba(2, 6, 23, 0.92)",
                  borderBottom: "1px solid rgba(248,250,252,0.12)",
                  display: "flex",
                  gap: 1,
                  justifyContent: "space-between",
                  px: { xs: 1, md: 2 },
                  py: 1,
                }}
              >
                <Stack direction="row" spacing={1}>
                  <IconButton
                    aria-label="上一頁"
                    disabled={pageIndex === 0}
                    onClick={() => goToImagePage(pageIndex - 1)}
                    sx={{ color: "#f8fafc" }}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="下一頁"
                    disabled={pageIndex >= totalEpisodePages - 1}
                    onClick={() => goToImagePage(pageIndex + 1)}
                    sx={{ color: "#f8fafc" }}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography
                  fontWeight={900}
                  sx={{
                    minWidth: 0,
                    overflow: "hidden",
                    textAlign: "center",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  variant="body2"
                >
                  {currentEpisode.title}（第 {pageIndex + 1} /{" "}
                  {totalEpisodePages} 頁）
                </Typography>
                <IconButton
                  aria-label="關閉"
                  onClick={() => setImageLightboxOpen(false)}
                  sx={{ color: "#f8fafc" }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
              <Box
                onClick={() => setImageLightboxOpen(false)}
                sx={{
                  height: "calc(100vh - 57px)",
                  width: "100vw",
                  overflow: "auto",
                  display: "flex",
                  justifyContent: "center",
                  cursor: "zoom-out",
                }}
              >
                <Box
                  component="img"
                  src={currentEpisodePages[pageIndex]?.imageUrl}
                  alt={`第 ${pageIndex + 1} 頁（原圖）`}
                  sx={{
                    display: "block",
                    height: "auto",
                    maxWidth: "none",
                    width: "auto",
                  }}
                />
              </Box>
            </Dialog>
            {/* 進度列緊貼在圖片下面，視覺上歸屬圖片這個區塊——跟 YouTube 播放器的
                進度列會貼著影片畫面下緣，換頁按鈕才是再下一層的操作列，是同一個道理。 */}
            <ImagePageScrubber
              pages={currentEpisodePages}
              currentIndex={pageIndex}
              onJump={goToImagePage}
            />
            <Stack direction="row" justifyContent="space-between">
              <IconButton
                disabled={pageIndex === 0}
                onClick={() => goToImagePage(pageIndex - 1)}
              >
                <ArrowBackIcon />
              </IconButton>
              <IconButton
                disabled={pageIndex >= totalEpisodePages - 1}
                onClick={() => goToImagePage(pageIndex + 1)}
              >
                <ArrowForwardIcon />
              </IconButton>
            </Stack>
            {/* 文字說明緊接在換頁按鈕後面，不要被縮圖列隔開——縮圖列是跳頁用的
                導覽工具，不是這一頁的內容，擺在文字前面會打斷「看圖→看說明」的視線。 */}
            {currentEpisodePages[pageIndex]?.description && (
              <Box sx={{ px: { xs: 0, md: 1 } }}>
                <StorytellerWysiwygMarkdown showFootnoteSection={false}>
                  {currentEpisodePages[pageIndex].description}
                </StorytellerWysiwygMarkdown>
              </Box>
            )}
          </Stack>
        </Stack>
      ) : currentStory ? (
        <Stack
          spacing={2}
          sx={{
            width: "100%",
            maxWidth: preferences.measure,
            alignSelf: "center",
          }}
        >
          <ContentMetaHeader
            title={currentStory.title}
            titleRef={contentTitleRef}
            summary={currentStory.summary}
            authorPenNames={
              currentStory.authorPenNames.length > 0
                ? currentStory.authorPenNames
                : project.authorPenNames
            }
            updatedAt={currentStory.updatedAt}
          />
          {isHistoricalView && (
            <Box
              onClick={() => setHistoricalVersionId(undefined)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                bgcolor: "warning.light",
                color: "warning.contrastText",
                cursor: "pointer",
              }}
            >
              <Typography variant="body2">
                此非最新版本（第 {versions.length - historicalVersionIndex}{" "}
                版），內容為當時儲存的版本，僅能移除既有書籤，無法新增
              </Typography>
              <Typography
                variant="body2"
                fontWeight={800}
                sx={{ flexShrink: 0 }}
              >
                點擊查看最新版本 →
              </Typography>
            </Box>
          )}
          <Divider />
          <ReaderTextFrame preferences={preferences}>
            <StoryContentLines
              content={displayContent ?? currentStory.content}
              bookmarkedLines={bookmarkedLines}
              pendingLines={pendingBookmarkLines}
              bookmarkMode={bookmarkMode}
              bookmarkEditing={bookmarkEditing}
              highlightedLine={highlightedLine}
              onToggleBookmark={handleToggleBookmark}
              footnoteNumbering={footnoteNumbering}
              footnoteIdPrefix={footnoteIdPrefix}
            />
            {/* 腳注固定放在整篇故事的最尾端，跟內容裡有沒有標題、標題怎麼分段無關——
                所以是在這裡（逐行內容渲染完之後）渲染一次，不是讓上面每一行各自渲染。 */}
            <StorytellerFootnoteSection
              list={footnoteNumbering.list}
              idPrefix={footnoteIdPrefix}
            />
          </ReaderTextFrame>
        </Stack>
      ) : (
        <Typography color="text.secondary">目前還沒有任何作品。</Typography>
      )}
      {currentItem && (
        <>
          <Box
            aria-hidden="true"
            data-reader-bottom-spacer
            sx={{ height: "calc(88px + env(safe-area-inset-bottom))" }}
          />
        </>
      )}
    </Paper>
  );

  // 作品首頁：標題區塊自己帶標題，所以 Shell 的標題一律隱藏。
  const workLanding = (
    <ReaderWorkLanding
      name={project.name}
      description={project.description}
      coverUrl={project.coverUrl}
      coverLayout={project.coverLayout}
      coverFocalPoint={project.coverFocalPoint}
      meta={
        <>
          {projectPrimaryMeta}
          {projectSecondaryMeta}
        </>
      }
      items={items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        contentType: item.contentType,
        parentId: item.parentId,
        updatedAt: item.updatedAt,
        href: readerStoryPath(basePath, item.id),
        progress: readingRecords.storyProgress(item.id),
      }))}
      volumes={volumes}
      tab={landingTab}
      storiesHref={basePath}
      loresHref={loresPath}
      discussionsHref={readerDiscussionsPath(basePath)}
      discussionBoard={
        discussion && <ReaderDiscussionBoard context={discussion} />
      }
      loreGroups={project.loreGroups.map((group) => ({
        id: group.collection?.id ?? null,
        name: group.collection?.name ?? "未歸類",
        lores: group.lores.map((lore) => ({
          id: lore.id,
          title: lore.title,
          summary: lore.summary,
          updatedAt: lore.updatedAt,
          href: readerLorePath(basePath, lore.id),
          lockHint: spoilerGate.isLocked(lore)
            ? spoilerLockHint(spoilerGate.unmetDependencies(lore))
            : undefined,
          progress:
            readingRecords.progressMap[readingTargetKey("lore", lore.id)],
        })),
      }))}
    />
  );
  const pageBody = currentItem ? (
    readerBody
  ) : currentLore ? (
    <ReaderLorePage
      lore={currentLore}
      collectionName={currentLoreCollection?.name}
      bodyRef={setReaderBodyNode}
      titleRef={contentTitleRef}
      preferences={preferences}
      gate={
        currentLoreLocked
          ? {
              dependencies: spoilerGate
                .unmetDependencies(currentLore)
                .map((dependency) => ({
                  key: readingTargetKey(dependency.type, dependency.id),
                  type: dependency.type,
                  title: dependency.title,
                  href:
                    dependency.type === "story"
                      ? readerStoryPath(basePath, dependency.id)
                      : readerLorePath(basePath, dependency.id),
                  progress:
                    readingRecords.progressMap[
                      readingTargetKey(dependency.type, dependency.id)
                    ],
                })),
              onConfirm: () => spoilerGate.confirm(currentLore.id),
            }
          : undefined
      }
    />
  ) : (
    workLanding
  );
  const isContentPage = Boolean(currentItem || currentLore);
  // 故事、圖像說明、設定內文裡的設定連結（steamloom-lore://）都由這裡決定怎麼呈現
  const linkedPageBody = (
    <ReaderLoreLinkProvider
      lores={loreOrder}
      collectionNames={
        new Map(
          project.loreGroups.flatMap((group) =>
            group.collection
              ? [[group.collection.id, group.collection.name] as const]
              : [],
          ),
        )
      }
      basePath={basePath}
      gate={spoilerGate}
      progressMap={readingRecords.progressMap}
      preferences={preferences}
      onLoreRead={(loreId) => readingRecords.report("lore", loreId, 100)}
    >
      {pageBody}
    </ReaderLoreLinkProvider>
  );

  return (
    <StorytellerShell
      title={project.name}
      hideHeading
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        ...(currentItem
          ? [
              { label: project.name, to: projectLandingPath },
              { label: currentItem.title },
            ]
          : currentLore
            ? [
                { label: project.name, to: projectLandingPath },
                { label: "設定", to: loresPath },
                ...(currentLoreCollection
                  ? [
                      {
                        label: currentLoreCollection.name,
                        to: `${loresPath}#${readerLoreGroupAnchorId(currentLoreCollection.id)}`,
                      },
                    ]
                  : []),
                { label: spoilerGate.displayTitle(currentLore) },
              ]
            : landingTab === "lores"
              ? [
                  { label: project.name, to: projectLandingPath },
                  { label: "設定" },
                ]
              : landingTab === "discussions"
                ? [
                    { label: project.name, to: projectLandingPath },
                    { label: "討論" },
                  ]
                : [{ label: project.name }]),
      ]}
    >
      {isContentPage && (
        <GlobalStyles
          styles={{
            "body footer": {
              paddingBottom:
                "calc(88px + env(safe-area-inset-bottom)) !important",
            },
          }}
        />
      )}
      {isContentPage && (
        <StorytellerReaderToolbar
          projectName={project.name}
          currentTitle={
            currentItem?.title ??
            (currentLore ? spoilerGate.displayTitle(currentLore) : undefined)
          }
          // 劇透設定鎖住時顯示的是確認卡片，不是正文，進度條不該看起來像讀完了
          progress={currentLoreLocked ? 0 : readingProgress}
          navigationOpen={indexOpen}
          onOpenNavigation={() => setIndexOpen(true)}
          // 設定頁的「目錄」直接回設定列表，上一則／下一則只在設定之間切換
          navigationHref={currentLore ? loresPath : undefined}
          discussionButton={
            discussion && (
              <ReaderDiscussionButton
                context={discussion}
                anchor={
                  currentLore
                    ? {
                        type: "lore",
                        id: currentLore.id,
                        label: spoilerGate.displayTitle(currentLore),
                      }
                    : {
                        type: "story",
                        id: currentItem?.id ?? "",
                        label: currentItem?.title ?? "",
                      }
                }
              />
            )
          }
          reportButton={
            apiProject &&
            !isOwner && (
              <ReaderReportButton
                projectPublicId={apiProject.public_id}
                share={shareToken}
                lore={
                  currentLore && {
                    id: currentLore.id,
                    label: spoilerGate.displayTitle(currentLore),
                  }
                }
                story={
                  currentItem && {
                    id: currentItem.id,
                    label: currentItem.title,
                  }
                }
              />
            )
          }
          labels={currentLore ? LORE_TOOLBAR_LABELS : undefined}
          projectDetails={projectDetails}
          bookmarkEditing={bookmarkEditing}
          bookmarkEditingAvailable={Boolean(
            currentStory && bookmarkMode !== "none",
          )}
          onToggleBookmarkEditing={() =>
            setBookmarkEditing((editing) => !editing)
          }
          renderHistory={
            currentStory && !isShareRoute
              ? (onClose) => (
                  <StorytellerReaderHistory
                    versions={versionsQuery.data ?? []}
                    loading={versionsQuery.isLoading}
                    basePath={basePath}
                    storyId={currentStory.id}
                    onSelect={onClose}
                  />
                )
              : undefined
          }
          previousChapter={
            currentLore
              ? previousLore && {
                  title: spoilerGate.displayTitle(previousLore),
                  href: readerLorePath(basePath, previousLore.id),
                }
              : previousItem && {
                  title: previousItem.title,
                  href: readerStoryPath(basePath, previousItem.id),
                }
          }
          nextChapter={
            currentLore
              ? nextLore && {
                  title: spoilerGate.displayTitle(nextLore),
                  href: readerLorePath(basePath, nextLore.id),
                }
              : nextItem && {
                  title: nextItem.title,
                  href: readerStoryPath(basePath, nextItem.id),
                }
          }
          preferences={preferences}
          onChangePreferences={updatePreferences}
        />
      )}

      <Drawer
        anchor="left"
        open={indexOpen}
        onClose={() => setIndexOpen(false)}
      >
        <Box sx={{ width: { xs: 320, sm: 380 }, maxWidth: "92vw", p: 2 }}>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
            <IconButton
              aria-label="關閉索引"
              onClick={() => setIndexOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <ReaderIndexPanel
            items={items}
            volumes={volumes}
            currentItemId={currentItem?.id}
            basePath={basePath}
            onNavigate={() => setIndexOpen(false)}
            bookmarks={projectBookmarks}
            bookmarksEnabled={Boolean(session)}
            bookmarksLoading={projectBookmarksQuery.isLoading}
            onJumpToBookmark={handleJumpToBookmark}
            onDeleteBookmark={handleDeleteBookmarkFromList}
            pendingDeleteBookmarkIds={pendingDeleteBookmarkIds}
            headings={storyHeadings}
            activeHeadingLine={activeHeadingLine}
            onJumpToHeading={handleJumpToHeading}
            imagePages={currentEpisodePages}
            activeImagePageIndex={pageIndex}
            onJumpToImagePage={goToImagePage}
          />
        </Box>
      </Drawer>

      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="追蹤專案、追蹤作者、評分故事或加入書籤需要登入。是否要現在登入？"
      />
      <CustomSnackbar
        open={bookmarkSnackbar.open}
        message={bookmarkSnackbar.message}
        severity={bookmarkSnackbar.severity ?? "success"}
        onClose={() =>
          setBookmarkSnackbar((prev) => ({ ...prev, open: false }))
        }
      />
      <CustomSnackbar
        open={readingResume.resumedProgress !== null}
        severity="info"
        autoHideDuration={6000}
        message={`已回到上次閱讀的位置（${readingResume.resumedProgress ?? 0}%）`}
        onClose={readingResume.dismiss}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              readingResume.dismiss();
              if (currentEpisode) {
                setPageIndex(0);
              } else {
                contentTitleRef.current?.scrollIntoView({ block: "start" });
              }
            }}
          >
            從頭開始
          </Button>
        }
      />
      <StorytellerMascotDialog
        open={deleteBookmarkTarget !== null}
        state="danger"
        eyebrow="刪除書籤"
        title="確定要刪除這筆書籤？"
        description="這筆書籤會從閱讀清單移除；若是舊版本或已失效的位置，之後可能無法重新加入。"
        onClose={() => setDeleteBookmarkTarget(null)}
        actions={
          <>
            <Button onClick={() => setDeleteBookmarkTarget(null)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleteBookmark.isPending}
              onClick={confirmDeleteBookmarkFromList}
            >
              {deleteBookmark.isPending ? "刪除中" : "刪除書籤"}
            </Button>
          </>
        }
      />

      {project.rating === "restricted" && !isOwner ? (
        <AgeConfirmationGate
          description="此創作專案標示為限制級，請確認你已年滿 18 歲後再繼續閱讀。"
          leaveTo={steamloomPath()}
          panelTitle="限制級創作專案"
        >
          {linkedPageBody}
        </AgeConfirmationGate>
      ) : (
        linkedPageBody
      )}
    </StorytellerShell>
  );
}
