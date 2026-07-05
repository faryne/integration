import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Fab,
  Grid,
  IconButton,
  Paper,
  Popover,
  Rating,
  Stack,
  Tooltip,
  Typography,
  Zoom,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  useStorytellerProject,
  useCreateStorytellerStoryBookmark,
  useDeleteStorytellerStoryBookmark,
  usePublicStorytellerStoryLatestVersion,
  usePublicStorytellerStoryVersions,
  useSaveStorytellerAuthorFavorite,
  useSaveStorytellerProjectFavorite,
  useSaveStorytellerProjectRanking,
  usePublicStorytellerProject,
  useSharedStorytellerProject,
  useStorytellerAuthorFavorite,
  useStorytellerProjectFavorite,
  useStorytellerProjectRanking,
  useStorytellerProjectBookmarks,
  useStorytellerStoryBookmarks,
} from "@/apis/storyteller.ts";
import {
  formatStorytellerDate,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerStoryBookmarkWithStory } from "@/types/storyteller.ts";

interface ReaderStory {
  id: string;
  title: string;
  summary: string;
  content: string;
  sort: number;
  updatedAt: string;
}

interface ReaderProject {
  id: string;
  name: string;
  description: string;
  path: string;
  authorUserId?: number;
  authorPenName?: string;
  rating: "general" | "guidance" | "restricted";
  tags: string[];
  wordCount: number;
  stories: ReaderStory[];
}

function StoryIndex({
  stories,
  currentStoryId,
  basePath,
  onNavigate,
}: {
  stories: ReaderStory[];
  currentStoryId?: string;
  basePath: string;
  onNavigate?: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AutoStoriesIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>
          故事索引
        </Typography>
      </Stack>
      <Divider />
      {stories.map((story, index) => (
        <Button
          key={story.id}
          component={RouterLink}
          to={`${basePath}/${story.id}`}
          variant={currentStoryId === story.id ? "contained" : "text"}
          sx={{ justifyContent: "flex-start", textAlign: "left" }}
          onClick={onNavigate}
        >
          {index + 1}. {story.title}
        </Button>
      ))}
    </Stack>
  );
}

function StoryIndexPanel({
  stories,
  currentStoryId,
  basePath,
  onNavigate,
  bookmarks,
  bookmarksEnabled,
  bookmarksLoading,
  onJumpToBookmark,
}: {
  stories: ReaderStory[];
  currentStoryId?: string;
  basePath: string;
  onNavigate?: () => void;
  bookmarks: StorytellerStoryBookmarkWithStory[];
  bookmarksEnabled: boolean;
  bookmarksLoading: boolean;
  onJumpToBookmark: (bookmark: StorytellerStoryBookmarkWithStory) => void;
}) {
  const [tab, setTab] = useState<"toc" | "bookmarks">("toc");
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant={tab === "toc" ? "contained" : "outlined"}
          onClick={() => setTab("toc")}
          sx={{ flex: 1 }}
        >
          目錄
        </Button>
        <Button
          size="small"
          variant={tab === "bookmarks" ? "contained" : "outlined"}
          onClick={() => setTab("bookmarks")}
          sx={{ flex: 1 }}
        >
          書籤{bookmarks.length > 0 ? ` ${bookmarks.length}` : ""}
        </Button>
      </Stack>
      {tab === "toc" ? (
        <StoryIndex
          stories={stories}
          currentStoryId={currentStoryId}
          basePath={basePath}
          onNavigate={onNavigate}
        />
      ) : (
        <Stack spacing={1}>
          {!bookmarksEnabled ? (
            <Typography variant="body2" color="text.secondary">
              登入後即可查看你的書籤。
            </Typography>
          ) : bookmarksLoading ? (
            <Typography variant="body2" color="text.secondary">
              載入書籤中...
            </Typography>
          ) : bookmarks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              還沒有加入任何書籤，閱讀時點擊每行左側的書籤圖示即可加入。
            </Typography>
          ) : (
            bookmarks.map((bookmark) => {
              const story = stories.find(
                (item) => item.id === bookmark.story_public_id,
              );
              const isStale =
                bookmark.story_version_id !== bookmark.latest_story_version_id;
              const lineText = bookmark.line_preview.trim();
              const snippet =
                lineText.length > 10
                  ? `${lineText.slice(0, 10)}…`
                  : lineText;
              return (
                <Paper
                  key={bookmark.id}
                  variant="outlined"
                  sx={{ p: 1, borderRadius: 1, cursor: "pointer" }}
                  onClick={() => {
                    onJumpToBookmark(bookmark);
                    onNavigate?.();
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {story?.title ?? bookmark.story_title}
                    </Typography>
                    {isStale && (
                      <Chip
                        size="small"
                        label="非最新版本"
                        color="warning"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 11 }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2">
                    第 {bookmark.line_index + 1} 行
                    {snippet && (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        {" "}
                        · {snippet}
                      </Typography>
                    )}
                  </Typography>
                </Paper>
              );
            })
          )}
        </Stack>
      )}
    </Stack>
  );
}

function ChapterNavCard({
  label,
  title,
  to,
  disabled = false,
  align = "left",
}: {
  label: string;
  title: string;
  to?: string;
  disabled?: boolean;
  align?: "left" | "center" | "right";
}) {
  const LabelIcon =
    align === "left"
      ? ArrowBackIcon
      : align === "right"
        ? ArrowForwardIcon
        : undefined;

  return (
    <Paper
      component={to ? RouterLink : "div"}
      to={to}
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 0.5,
        px: 1.75,
        py: 1.5,
        minHeight: 40,
        borderRadius: 1,
        textDecoration: "none",
        color: "inherit",
        opacity: disabled ? 0.55 : 1,
        overflow: "hidden",
        textAlign: align,
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent={
          align === "center"
            ? "center"
            : align === "right"
              ? "flex-end"
              : "flex-start"
        }
        sx={{ color: "text.secondary" }}
      >
        {align === "left" && LabelIcon && <LabelIcon sx={{ fontSize: 14 }} />}
        <Typography variant="caption" color="inherit">
          {label}
        </Typography>
        {align === "right" && LabelIcon && <LabelIcon sx={{ fontSize: 14 }} />}
      </Stack>
      <Typography
        fontWeight={800}
        sx={{
          lineHeight: 1.35,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {title}
      </Typography>
    </Paper>
  );
}

type BookmarkMode = "full" | "removeOnly" | "none";

function StoryContentLines({
  content,
  bookmarkedLines,
  pendingLines,
  bookmarkMode,
  highlightedLine,
  onToggleBookmark,
}: {
  content: string;
  bookmarkedLines: Set<number>;
  pendingLines: Set<number>;
  bookmarkMode: BookmarkMode;
  highlightedLine?: number;
  onToggleBookmark: (lineIndex: number) => void;
}) {
  const lines = content.split("\n");
  return (
    <Stack spacing={0.25}>
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <Box key={index} sx={{ height: 12 }} />;
        }
        const isBookmarked = bookmarkedLines.has(index);
        const showIcon =
          bookmarkMode === "full" ||
          (bookmarkMode === "removeOnly" && isBookmarked);
        return (
          <Box
            key={index}
            id={`bookmark-line-${index}`}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.5,
              borderRadius: 1,
              transition: "background-color .6s",
              bgcolor:
                highlightedLine === index ? "action.selected" : undefined,
              "&:hover .bookmark-ghost": { opacity: 1 },
            }}
          >
            <Box sx={{ width: 30, flexShrink: 0, pt: 0.25 }}>
              {showIcon && (
                <Tooltip
                  title={isBookmarked ? "移除書籤" : "加入書籤"}
                  enterTouchDelay={0}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={isBookmarked ? "移除書籤" : "加入書籤"}
                      disabled={pendingLines.has(index)}
                      onClick={() => onToggleBookmark(index)}
                      className={isBookmarked ? undefined : "bookmark-ghost"}
                      sx={{
                        opacity: isBookmarked ? 1 : 0,
                        transition: "opacity .12s",
                        color: isBookmarked ? "primary.main" : "text.secondary",
                      }}
                    >
                      {isBookmarked ? (
                        <BookmarkIcon fontSize="small" />
                      ) : (
                        <BookmarkBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StorytellerMarkdown>{line}</StorytellerMarkdown>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default function StorytellerReader() {
  const { session, loading: authLoading } = useAuth();
  const params = useParams();
  const { shareToken } = params;
  const routeStoryPath = params["*"];
  const routeStoryParts = routeStoryPath?.split("/").filter(Boolean) ?? [];
  const routeStoryId =
    params.storyId ??
    (routeStoryParts.length > 1
      ? routeStoryParts[routeStoryParts.length - 1]
      : undefined);
  const routeProjectPath = routeStoryPath
    ? routeStoryParts.slice(0, routeStoryId ? -1 : undefined).join("/")
    : params.projectPath;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [indexOpen, setIndexOpen] = useState(true);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [pendingBookmarkLines, setPendingBookmarkLines] = useState<
    Set<number>
  >(new Set());
  const [bookmarkSnackbar, setBookmarkSnackbar] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const [pendingScrollLineIndex, setPendingScrollLineIndex] = useState<
    number | undefined
  >(undefined);
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>(
    undefined,
  );
  const [versionListOpen, setVersionListOpen] = useState(false);
  const [historicalVersionId, setHistoricalVersionId] = useState<
    number | undefined
  >(undefined);
  const navigate = useNavigate();
  // 頂端功能列（索引開關＋收藏／評分）是否仍在可視範圍；捲出畫面後改顯示右下角快速按鈕
  const [actionBarVisible, setActionBarVisible] = useState(true);
  // 右下角快速按鈕展開的選單錨點
  const [quickActionsAnchor, setQuickActionsAnchor] =
    useState<HTMLElement | null>(null);
  const actionBarRef = useRef<HTMLDivElement | null>(null);
  const storyStartRef = useRef<HTMLHeadingElement | null>(null);
  const previousStoryIdRef = useRef<string | undefined>(undefined);
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
  const isOwner = Boolean(
    apiProject && session?.user.id && apiProject.user_id === session.user.id,
  );
  const favoriteQuery = useStorytellerProjectFavorite(
    isOwner ? undefined : apiProject?.public_id,
  );
  const saveFavorite = useSaveStorytellerProjectFavorite(
    isOwner ? undefined : apiProject?.public_id,
  );
  const authorFavoriteQuery = useStorytellerAuthorFavorite(
    isOwner ? undefined : apiProject?.user_id,
  );
  const saveAuthorFavorite = useSaveStorytellerAuthorFavorite(
    isOwner ? undefined : apiProject?.user_id,
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
  const isAuthorFavorited = authorFavoriteQuery.data?.favorited ?? false;
  const rating = rankingQuery.data?.ranking ?? null;
  const project: ReaderProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
        path: `/storyteller/story/${apiProject.public_id}-${apiProject.slug}`,
        authorUserId: apiProject.user_id,
        authorPenName: apiProject.author?.pen_name,
        rating: apiProject.rating,
        tags: apiProject.tags ?? [],
        wordCount: (apiProject.stories ?? []).reduce(
          (total, story) => total + story.word_count,
          0,
        ),
        stories: (apiProject.stories ?? []).map((story) => ({
          id: story.public_id,
          title: story.title,
          summary: story.summary,
          content: story.latest_content,
          sort: story.sort,
          updatedAt: story.updated_at,
        })),
      }
    : undefined;
  const stories = project?.stories ?? [];
  const currentStoryId = routeStoryId;
  const currentStory = currentStoryId
    ? stories.find((story) => story.id === currentStoryId)
    : (stories.find((story) => story.sort === 0) ?? stories[0]);
  const currentStoryIndex = currentStory
    ? stories.findIndex((story) => story.id === currentStory.id)
    : -1;
  const previousStory =
    currentStoryIndex > 0 ? stories[currentStoryIndex - 1] : undefined;
  const nextStory =
    currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1
      ? stories[currentStoryIndex + 1]
      : undefined;
  const latestVersionQuery = usePublicStorytellerStoryLatestVersion(
    apiProject?.public_id,
    currentStory?.id,
  );
  const versionsQuery = usePublicStorytellerStoryVersions(
    apiProject?.public_id,
    currentStory?.id,
  );
  const bookmarksQuery = useStorytellerStoryBookmarks(
    apiProject?.public_id,
    currentStory?.id,
  );
  const createBookmark = useCreateStorytellerStoryBookmark(
    apiProject?.public_id,
    currentStory?.id,
  );
  const deleteBookmark = useDeleteStorytellerStoryBookmark(
    apiProject?.public_id,
    currentStory?.id,
  );
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
  const bookmarkedLines = new Set(
    (bookmarksQuery.data ?? [])
      .filter((bookmark) => bookmark.story_version_id === displayVersionId)
      .map((bookmark) => bookmark.line_index),
  );
  const bookmarkMode: BookmarkMode = isOwner
    ? "none"
    : isHistoricalView
      ? "removeOnly"
      : displayVersionId
        ? "full"
        : "none";
  const handleToggleBookmark = (lineIndex: number) => {
    if (!session) {
      setLoginPromptOpen(true);
      return;
    }
    if (!displayVersionId || pendingBookmarkLines.has(lineIndex)) {
      return;
    }
    const isBookmarked = bookmarkedLines.has(lineIndex);
    if (isHistoricalView && !isBookmarked) {
      return;
    }
    setPendingBookmarkLines((prev) => new Set(prev).add(lineIndex));
    const mutation = isBookmarked ? deleteBookmark : createBookmark;
    mutation.mutate(
      { versionId: displayVersionId, lineIndex },
      {
        onSuccess: () => {
          setBookmarkSnackbar({
            open: true,
            message: isBookmarked ? "書籤已刪除" : "書籤已加入",
          });
        },
        onSettled: () => {
          setPendingBookmarkLines((prev) => {
            const next = new Set(prev);
            next.delete(lineIndex);
            return next;
          });
        },
      },
    );
  };
  const projectBookmarksQuery = useStorytellerProjectBookmarks(
    apiProject?.public_id,
  );
  const projectBookmarks = projectBookmarksQuery.data ?? [];
  useEffect(() => {
    if (pendingScrollLineIndex === undefined) {
      return;
    }
    const targetIndex = pendingScrollLineIndex;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`bookmark-line-${targetIndex}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedLine(targetIndex);
      setPendingScrollLineIndex(undefined);
      setTimeout(() => setHighlightedLine(undefined), 1200);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentStory?.id, pendingScrollLineIndex]);
  const isShareRoute = Boolean(shareToken);
  const isPrivateOwnerRoute =
    isOwner && apiProject?.visibility === "private" && !isShareRoute;
  const shouldUseStorySeo = Boolean(project && !isPrivateOwnerRoute);

  useTitle(project ? `${project.name} - Storyteller` : "Storyteller", {
    description: shouldUseStorySeo ? project?.description : undefined,
    path: routeProjectPath
      ? `/storyteller/story/${routeProjectPath}${currentStoryId ? `/${currentStoryId}` : ""}`
      : shareToken
        ? `/storyteller/story/share/${shareToken}${currentStoryId ? `/${currentStoryId}` : ""}`
        : "",
    robots:
      isShareRoute || isPrivateOwnerRoute
        ? "noindex, nofollow"
        : "index, follow",
    type: shouldUseStorySeo ? "article" : "website",
  });

  useEffect(() => {
    if (!currentStory?.id) {
      return;
    }
    if (!previousStoryIdRef.current) {
      previousStoryIdRef.current = currentStory.id;
      return;
    }
    if (previousStoryIdRef.current === currentStory.id) {
      return;
    }

    previousStoryIdRef.current = currentStory.id;
    storyStartRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentStory?.id]);

  // 監看頂端功能列是否捲出畫面，用來切換右下角快速按鈕的顯示
  useEffect(() => {
    const node = actionBarRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setActionBarVisible(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentStory?.id, isOwner]);

  if (
    !project &&
    (authLoading ||
      publicProjectQuery.isLoading ||
      sharedProjectQuery.isLoading ||
      ownerProjectQuery.isLoading)
  ) {
    return <StorytellerLoading label="正在載入故事..." />;
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  const basePath = isShareRoute
    ? `/storyteller/story/share/${shareToken}`
    : project.path;
  const handleJumpToBookmark = (
    bookmark: StorytellerStoryBookmarkWithStory,
  ) => {
    const isStale =
      bookmark.story_version_id !== bookmark.latest_story_version_id;
    setHistoricalVersionId(isStale ? bookmark.story_version_id : undefined);
    setPendingScrollLineIndex(bookmark.line_index);
    if (bookmark.story_public_id !== currentStory?.id) {
      navigate(`${basePath}/${bookmark.story_public_id}`);
    }
  };
  const showInlineIndex = !isMobile && indexOpen;
  // 收藏／收藏作者／評分控制項，供頂端功能列與右下角快速選單共用
  const readerActions = (
    <>
      <Button
        variant={isFavorited ? "contained" : "outlined"}
        startIcon={isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
        disabled={saveFavorite.isPending}
        onClick={() => {
          if (!session) {
            setLoginPromptOpen(true);
            return;
          }
          if (apiProject?.public_id) {
            saveFavorite.mutate(!isFavorited);
            return;
          }
          setFavorite((value) => !value);
        }}
      >
        {isFavorited ? "已收藏" : "收藏"}
      </Button>
      {project.authorUserId && (
        <Button
          variant={isAuthorFavorited ? "contained" : "outlined"}
          startIcon={
            isAuthorFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />
          }
          disabled={saveAuthorFavorite.isPending}
          onClick={() => {
            if (!session) {
              setLoginPromptOpen(true);
              return;
            }
            saveAuthorFavorite.mutate(!isAuthorFavorited);
          }}
        >
          {isAuthorFavorited ? "已收藏作者" : "收藏作者"}
        </Button>
      )}
      <Paper variant="outlined" sx={{ px: 1.5, py: 0.75, borderRadius: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            評分
          </Typography>
          <Rating
            value={rating}
            precision={0.5}
            disabled={saveRanking.isPending}
            onChange={(_, value) => {
              if (!session) {
                setLoginPromptOpen(true);
                return;
              }
              if (apiProject?.public_id && value !== null) {
                saveRanking.mutate(value);
              }
            }}
          />
        </Stack>
      </Paper>
    </>
  );
  const readerBody = (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
      {currentStory ? (
        <Stack spacing={2}>
          <Box>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography
                ref={storyStartRef}
                component="h1"
                variant="h4"
                fontWeight={800}
                sx={{ scrollMarginTop: 24 }}
              >
                {currentStory.title}
              </Typography>
              {!isOwner && (
                <Tooltip title="版本歷史">
                  <IconButton
                    size="small"
                    aria-label="版本歷史"
                    onClick={() => setVersionListOpen((open) => !open)}
                    sx={{
                      flexShrink: 0,
                      color: versionListOpen ? "primary.main" : "text.secondary",
                    }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {currentStory.summary}
            </Typography>
            {versionListOpen && (
              <Paper
                variant="outlined"
                sx={{ mt: 1, borderRadius: 1, overflow: "hidden" }}
              >
                {versionsQuery.isLoading ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ p: 1.5 }}
                  >
                    載入版本中...
                  </Typography>
                ) : (
                  (versionsQuery.data ?? []).map((version, index, arr) => {
                    const isLatest = index === 0;
                    const label = isLatest
                      ? `第 ${arr.length} 版（最新）`
                      : `第 ${arr.length - index} 版`;
                    return (
                      <Box
                        key={version.id}
                        {...(isLatest
                          ? {}
                          : {
                              component: RouterLink,
                              to: `${basePath}/${currentStory.id}/versions/${version.id}`,
                            })}
                        onClick={() => setVersionListOpen(false)}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          px: 1.5,
                          py: 1,
                          borderBottom:
                            index < arr.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          textDecoration: "none",
                          color: "inherit",
                          cursor: isLatest ? "default" : "pointer",
                          "&:hover": isLatest
                            ? undefined
                            : { bgcolor: "action.hover" },
                        }}
                      >
                        <Typography variant="body2">{label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatStorytellerDate(version.created_at)}
                        </Typography>
                      </Box>
                    );
                  })
                )}
              </Paper>
            )}
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1 }}
            >
              {project.authorPenName && (
                <Typography
                  variant="caption"
                  color="primary"
                  component={RouterLink}
                  to={`/storyteller/user/${encodeURIComponent(project.authorPenName)}`}
                  sx={{
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  作者 {project.authorPenName}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                更新於 {formatStorytellerDate(currentStory.updatedAt)}
              </Typography>
            </Stack>
            {isHistoricalView && (
              <Box
                onClick={() => setHistoricalVersionId(undefined)}
                sx={{
                  mt: 1.5,
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
                  此非最新版本（第{" "}
                  {versions.length - historicalVersionIndex} 版），內容為當時儲存的版本，僅能移除既有書籤，無法新增
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
          </Box>
          <Divider />
          <Box
            sx={{
              typography: "body1",
              lineHeight: 1.9,
              "& h1": { typography: "h5", fontWeight: 800 },
              "& h2": { typography: "h6", fontWeight: 800, mt: 3 },
              "& p": { my: 0.5 },
            }}
          >
            <StoryContentLines
              content={displayContent ?? currentStory.content}
              bookmarkedLines={bookmarkedLines}
              pendingLines={pendingBookmarkLines}
              bookmarkMode={bookmarkMode}
              highlightedLine={highlightedLine}
              onToggleBookmark={handleToggleBookmark}
            />
          </Box>
          <Divider />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.5,
              minWidth: 0,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="上一章"
                title={previousStory?.title ?? "沒有上一章"}
                to={
                  previousStory ? `${basePath}/${previousStory.id}` : undefined
                }
                disabled={!previousStory}
                align="left"
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="本章"
                title={currentStory.title}
                align="center"
                disabled
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="下一章"
                title={nextStory?.title ?? "沒有下一章"}
                to={nextStory ? `${basePath}/${nextStory.id}` : undefined}
                disabled={!nextStory}
                align="right"
              />
            </Box>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Typography component="h1" variant="h4" fontWeight={800}>
            {project.name}
          </Typography>
          <Typography color="text.secondary">{project.description}</Typography>
          <Divider />
          <Typography>請從左側索引選擇故事章節開始閱讀。</Typography>
        </Stack>
      )}
    </Paper>
  );

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: project.name },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={
              isPrivateOwnerRoute
                ? "私人預覽"
                : isShareRoute
                  ? "專用連結"
                  : "公開閱讀"
            }
            color={
              isPrivateOwnerRoute
                ? "default"
                : isShareRoute
                  ? "warning"
                  : "success"
            }
          />
          {project.authorPenName && (
            <Chip
              label={`作者 ${project.authorPenName}`}
              variant="outlined"
              component={RouterLink}
              to={`/storyteller/user/${encodeURIComponent(project.authorPenName)}`}
              clickable
            />
          )}
          <Chip label={`${stories.length} 篇故事`} />
          <Chip label={`${project.wordCount.toLocaleString()} 字`} />
          <Chip
            label={storytellerProjectRatingLabel(project.rating)}
            color={storytellerProjectRatingColor(project.rating)}
            variant="outlined"
          />
          {project.tags.map((tag) => (
            <Chip key={tag} label={tag} variant="outlined" />
          ))}
        </Stack>
      }
    >
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileIndexOpen}
          onClose={() => setMobileIndexOpen(false)}
        >
          <Box sx={{ width: 320, maxWidth: "86vw", p: 2 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <IconButton
                aria-label="關閉故事索引"
                onClick={() => setMobileIndexOpen(false)}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <StoryIndexPanel
              stories={stories}
              currentStoryId={currentStory?.id}
              basePath={basePath}
              onNavigate={() => setMobileIndexOpen(false)}
              bookmarks={projectBookmarks}
              bookmarksEnabled={Boolean(session)}
              bookmarksLoading={projectBookmarksQuery.isLoading}
              onJumpToBookmark={handleJumpToBookmark}
            />
          </Box>
        </Drawer>
      )}

      <Stack
        ref={actionBarRef}
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Button
          variant="outlined"
          startIcon={<MenuBookIcon />}
          onClick={() =>
            isMobile ? setMobileIndexOpen(true) : setIndexOpen((open) => !open)
          }
        >
          {isMobile
            ? "開啟故事索引"
            : indexOpen
              ? "收起故事索引"
              : "展開故事索引"}
        </Button>
        {currentStory && !isOwner && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            {readerActions}
          </Stack>
        )}
      </Stack>

      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="收藏故事、收藏作者、評分故事或加入書籤需要登入。是否要現在登入？"
      />
      <CustomSnackbar
        open={bookmarkSnackbar.open}
        message={bookmarkSnackbar.message}
        onClose={() => setBookmarkSnackbar((prev) => ({ ...prev, open: false }))}
      />

      {/* 頂端功能列捲出畫面後，右下角出現快速按鈕：行動版可開故事索引、非作者可收藏與評分 */}
      {currentStory && (isMobile || !isOwner) && (
        <>
          <Stack
            spacing={1}
            alignItems="center"
            sx={{
              position: "fixed",
              right: { xs: 16, md: 32 },
              bottom: { xs: 16, md: 32 },
              zIndex: theme.zIndex.speedDial,
            }}
          >
            {isMobile && (
              <Zoom in={!actionBarVisible}>
                <Fab
                  size="medium"
                  aria-label="開啟故事索引"
                  onClick={() => setMobileIndexOpen(true)}
                >
                  <MenuBookIcon />
                </Fab>
              </Zoom>
            )}
            {!isOwner && (
              <Zoom in={!actionBarVisible}>
                <Fab
                  color="primary"
                  size="medium"
                  aria-label="開啟收藏與評分選單"
                  onClick={(event) =>
                    setQuickActionsAnchor(event.currentTarget)
                  }
                >
                  {isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
                </Fab>
              </Zoom>
            )}
          </Stack>
          <Popover
            open={Boolean(quickActionsAnchor)}
            anchorEl={quickActionsAnchor}
            onClose={() => setQuickActionsAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Stack spacing={1} sx={{ p: 1.5 }}>
              {readerActions}
            </Stack>
          </Popover>
        </>
      )}

      {project.rating === "restricted" && !isOwner ? (
        <AgeConfirmationGate
          description="此故事專案標示為限制級，請確認你已年滿 18 歲後再繼續閱讀。"
          leaveTo="/storyteller"
          panelTitle="限制級故事專案"
        >
          <Grid container spacing={2}>
            {showInlineIndex && (
              <Grid size={{ xs: 12, md: 4 }}>
                {/* 索引跟著頁面捲動；章節過多時在欄內自行捲動 */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    position: "sticky",
                    top: 80,
                    maxHeight: "calc(100vh - 96px)",
                    overflowY: "auto",
                  }}
                >
                  <StoryIndexPanel
                    stories={stories}
                    currentStoryId={currentStory?.id}
                    basePath={basePath}
                    bookmarks={projectBookmarks}
                    bookmarksEnabled={Boolean(session)}
                    bookmarksLoading={projectBookmarksQuery.isLoading}
                    onJumpToBookmark={handleJumpToBookmark}
                  />
                </Paper>
              </Grid>
            )}

            <Grid size={{ xs: 12, md: showInlineIndex ? 8 : 12 }}>
              {readerBody}
            </Grid>
          </Grid>
        </AgeConfirmationGate>
      ) : (
        <Grid container spacing={2}>
          {showInlineIndex && (
            <Grid size={{ xs: 12, md: 4 }}>
              {/* 索引跟著頁面捲動；章節過多時在欄內自行捲動 */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  position: "sticky",
                  top: 80,
                  maxHeight: "calc(100vh - 96px)",
                  overflowY: "auto",
                }}
              >
                <StoryIndexPanel
                  stories={stories}
                  currentStoryId={currentStory?.id}
                  basePath={basePath}
                  bookmarks={projectBookmarks}
                  bookmarksEnabled={Boolean(session)}
                  bookmarksLoading={projectBookmarksQuery.isLoading}
                  onJumpToBookmark={handleJumpToBookmark}
                />
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: showInlineIndex ? 8 : 12 }}>
            {readerBody}
          </Grid>
        </Grid>
      )}
    </StorytellerShell>
  );
}
