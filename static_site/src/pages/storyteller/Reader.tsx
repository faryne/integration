import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GridViewIcon from "@mui/icons-material/GridView";
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ViewListIcon from "@mui/icons-material/ViewList";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  Fab,
  Grid,
  IconButton,
  Paper,
  Popover,
  Rating,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Zoom,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  StorytellerFootnoteSection,
  StorytellerWysiwygMarkdown,
} from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  computeFootnoteNumbering,
  parseMarkdownToParagraphs,
  storyHeadingAnchorId,
  type FootnoteNumbering,
} from "@/pages/storyteller/wysiwygCore/parser.ts";
import type { HeadingLevel } from "@/pages/storyteller/wysiwygCore/whitelist.ts";
import {
  listImageEpisodes,
  type StorytellerImageEpisodeMock,
} from "@/pages/storyteller/storytellerImageEpisodeMock.ts";
import { flattenGroupedStories } from "@/pages/storyteller/storytellerVolumes.ts";
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import {
  steamLedgerEdgeSx,
  steamPanelTopBarSx,
} from "@/data/storytellerTheme.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import type { StorytellerStoryBookmarkWithStory } from "@/types/storyteller.ts";

interface ReaderStory {
  id: string;
  title: string;
  summary: string;
  content: string;
  sort: number;
  updatedAt: string;
  // 所屬冊的 id，null 代表未分冊；只用來在故事索引分組顯示，不影響上一章/下一章導覽
  // （導覽沿用 stories 陣列本身已經是「未分冊優先、接著依冊順序」排好的線性順序）。
  parentId: number | null;
}

interface ReaderVolume {
  id: number;
  title: string;
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
  volumes: ReaderVolume[];
}

interface StoryHeading {
  // lineIndex 只用來當 React key／跟 activeHeadingLine 比對「目前是哪一個」，不是拿來
  // 定位錨點——行號會因為前面內容增刪而改變，不是穩定的識別碼。
  lineIndex: number;
  level: HeadingLevel;
  text: string;
  // 實際跳轉／捲動高亮用的 DOM id：段落有 markerId（新版內容都會有）就用
  // storyHeadingAnchorId 直接定位到標題本身；沒有的話（舊資料尚未遷移）退回沿用
  // StoryContentLines 既有的 `bookmark-line-{lineIndex}` id。
  anchorId: string;
}

/** 從故事全文抽出標題清單，供側欄「本篇大綱」使用；沒有標題就回傳空陣列（呼叫端應該直接不顯示這個分頁）。 */
function extractStoryHeadings(content: string): StoryHeading[] {
  return parseMarkdownToParagraphs(content)
    .map((paragraph, lineIndex) => ({ paragraph, lineIndex }))
    .filter(({ paragraph }) => paragraph.headingLevel > 0)
    .map(({ paragraph, lineIndex }) => ({
      lineIndex,
      level: paragraph.headingLevel,
      text: paragraph.runs
        .map((run) => run.text)
        .join("")
        .trim(),
      anchorId: paragraph.markerId
        ? storyHeadingAnchorId(paragraph.markerId)
        : `bookmark-line-${lineIndex}`,
    }))
    .filter((heading) => heading.text.length > 0);
}

function StoryIndex({
  stories,
  volumes,
  currentStoryId,
  basePath,
  onNavigate,
}: {
  stories: ReaderStory[];
  volumes: ReaderVolume[];
  currentStoryId?: string;
  basePath: string;
  onNavigate?: () => void;
}) {
  // stories 本身已經是「未分冊優先、接著依冊順序」排好的線性順序（見
  // flattenGroupedStories），編號直接用這個順序的 index，分組只是視覺上加標題/分隔線，
  // 不影響編號，讀者看到的章節序號跟上一章/下一章導覽會是同一套。
  function storyIndexLabel(story: ReaderStory) {
    return stories.findIndex((item) => item.id === story.id) + 1;
  }
  const currentVolumeId =
    stories.find((story) => story.id === currentStoryId)?.parentId ?? null;
  // 預設展開「目前所在的那一冊」，其餘冊收合；使用者手動展開/收合過的冊維持原狀，
  // 只有換到別的冊時才會額外把那一冊加進展開清單，不會反過來收掉使用者已經打開的冊。
  const [expandedVolumeIds, setExpandedVolumeIds] = useState<Set<number>>(
    () => new Set(currentVolumeId !== null ? [currentVolumeId] : []),
  );
  useEffect(() => {
    if (currentVolumeId === null) {
      return;
    }
    setExpandedVolumeIds((previous) => {
      if (previous.has(currentVolumeId)) {
        return previous;
      }
      return new Set(previous).add(currentVolumeId);
    });
  }, [currentVolumeId]);

  function toggleVolume(volumeId: number) {
    setExpandedVolumeIds((previous) => {
      const next = new Set(previous);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  }

  const ungrouped = stories.filter((story) => story.parentId === null);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AutoStoriesIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>
          故事索引
        </Typography>
      </Stack>
      <Divider />
      {volumes.map((volume) => {
        const children = stories.filter(
          (story) => story.parentId === volume.id,
        );
        if (children.length === 0) {
          return null;
        }
        const expanded = expandedVolumeIds.has(volume.id);
        return (
          <Stack key={volume.id} spacing={0.5}>
            <Divider />
            <Stack
              component={ButtonBase}
              onClick={() => toggleVolume(volume.id)}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ borderRadius: 1, px: 1, py: 0.5, width: 1 }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ textAlign: "left" }}
              >
                {volume.title}
              </Typography>
              {expanded ? (
                <ExpandLessIcon fontSize="small" color="action" />
              ) : (
                <ExpandMoreIcon fontSize="small" color="action" />
              )}
            </Stack>
            <Collapse in={expanded}>
              <Stack spacing={0.5}>
                {children.map((story) => (
                  <Button
                    key={story.id}
                    component={RouterLink}
                    to={`${basePath}/story/${story.id}`}
                    variant={currentStoryId === story.id ? "contained" : "text"}
                    sx={{ justifyContent: "flex-start", textAlign: "left" }}
                    onClick={onNavigate}
                  >
                    {storyIndexLabel(story)}. {story.title}
                  </Button>
                ))}
              </Stack>
            </Collapse>
          </Stack>
        );
      })}
      {ungrouped.length > 0 && (
        <Stack spacing={0.5}>
          {volumes.length > 0 && (
            <>
              <Divider />
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ pl: 1 }}
              >
                未分冊故事
              </Typography>
            </>
          )}
          {ungrouped.map((story) => (
            <Button
              key={story.id}
              component={RouterLink}
              to={`${basePath}/story/${story.id}`}
              variant={currentStoryId === story.id ? "contained" : "text"}
              sx={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={onNavigate}
            >
              {storyIndexLabel(story)}. {story.title}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function StoryOutline({
  headings,
  activeLineIndex,
  onJumpToHeading,
}: {
  headings: StoryHeading[];
  activeLineIndex?: number;
  onJumpToHeading: (heading: StoryHeading) => void;
}) {
  return (
    <Stack spacing={0.5}>
      {headings.map((heading) => {
        const isActive = activeLineIndex === heading.lineIndex;
        return (
          <Button
            key={heading.lineIndex}
            size="small"
            variant="text"
            onClick={() => onJumpToHeading(heading)}
            sx={{
              justifyContent: "flex-start",
              textAlign: "left",
              pl: 1.5 + (heading.level - 1) * 1.5,
              color: isActive ? "primary.main" : "text.secondary",
              fontWeight: isActive ? 700 : 400,
              bgcolor: isActive ? "action.selected" : undefined,
              fontSize: heading.level >= 3 ? 13 : 14,
            }}
          >
            {heading.text}
          </Button>
        );
      })}
    </Stack>
  );
}

function StoryIndexPanel({
  stories,
  volumes,
  currentStoryId,
  basePath,
  onNavigate,
  bookmarks,
  bookmarksEnabled,
  bookmarksLoading,
  onJumpToBookmark,
  headings,
  activeHeadingLine,
  onJumpToHeading,
}: {
  stories: ReaderStory[];
  volumes: ReaderVolume[];
  currentStoryId?: string;
  basePath: string;
  onNavigate?: () => void;
  bookmarks: StorytellerStoryBookmarkWithStory[];
  bookmarksEnabled: boolean;
  bookmarksLoading: boolean;
  onJumpToBookmark: (bookmark: StorytellerStoryBookmarkWithStory) => void;
  headings: StoryHeading[];
  activeHeadingLine?: number;
  onJumpToHeading: (heading: StoryHeading) => void;
}) {
  const [tab, setTab] = useState<"toc" | "bookmarks" | "outline">("toc");
  const hasOutline = headings.length > 0;
  useEffect(() => {
    // 切到沒有標題的故事時，「本篇大綱」分頁會消失，這時候如果還停在該分頁要退回目錄，
    // 不然畫面會變成沒有任何分頁按鈕顯示為選取中。
    if (tab === "outline" && !hasOutline) {
      setTab("toc");
    }
  }, [tab, hasOutline]);
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
        {hasOutline && (
          <Button
            size="small"
            variant={tab === "outline" ? "contained" : "outlined"}
            onClick={() => setTab("outline")}
            sx={{ flex: 1 }}
          >
            本篇大綱
          </Button>
        )}
      </Stack>
      {tab === "toc" ? (
        <StoryIndex
          stories={stories}
          volumes={volumes}
          currentStoryId={currentStoryId}
          basePath={basePath}
          onNavigate={onNavigate}
        />
      ) : tab === "outline" && hasOutline ? (
        <StoryOutline
          headings={headings}
          activeLineIndex={activeHeadingLine}
          onJumpToHeading={(heading) => {
            onJumpToHeading(heading);
            onNavigate?.();
          }}
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
                lineText.length > 10 ? `${lineText.slice(0, 10)}…` : lineText;
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
                  <Typography variant="body2" color="text.secondary">
                    {snippet || "（空白段落）"}
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

function ImageIndexPanel({
  episodes,
  currentEpisodeId,
  basePath,
  tocView,
  onTocViewChange,
  onNavigate,
}: {
  episodes: StorytellerImageEpisodeMock[];
  currentEpisodeId?: string;
  basePath: string;
  tocView: "title" | "thumbnail";
  onTocViewChange: (view: "title" | "thumbnail") => void;
  onNavigate?: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <CollectionsIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>
            圖像目次
          </Typography>
        </Stack>
        <Stack direction="row">
          <Tooltip title="標題列表">
            <IconButton
              size="small"
              color={tocView === "title" ? "primary" : "default"}
              onClick={() => onTocViewChange("title")}
            >
              <ViewListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="縮圖">
            <IconButton
              size="small"
              color={tocView === "thumbnail" ? "primary" : "default"}
              onClick={() => onTocViewChange("thumbnail")}
            >
              <GridViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Divider />
      {episodes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          這個專案還沒有圖像作品。
        </Typography>
      ) : tocView === "thumbnail" ? (
        <Grid container spacing={1}>
          {episodes.map((episode) => (
            <Grid key={episode.id} size={6}>
              <ButtonBase
                component={RouterLink}
                to={`${basePath}/image/${episode.id}`}
                onClick={onNavigate}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  width: 1,
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "2px solid",
                  borderColor:
                    currentEpisodeId === episode.id
                      ? "primary.main"
                      : "divider",
                }}
              >
                {episode.pageDataUrls[0] ? (
                  <Box
                    component="img"
                    src={episode.pageDataUrls[0]}
                    alt={episode.title}
                    sx={{ width: 1, height: 96, objectFit: "cover" }}
                  />
                ) : (
                  <Box sx={{ width: 1, height: 96, bgcolor: "action.hover" }} />
                )}
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ px: 0.5, py: 0.5, width: 1, textAlign: "left" }}
                >
                  {episode.title}
                </Typography>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Stack spacing={0.5}>
          {episodes.map((episode) => (
            <Button
              key={episode.id}
              component={RouterLink}
              to={`${basePath}/image/${episode.id}`}
              variant={currentEpisodeId === episode.id ? "contained" : "text"}
              sx={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={onNavigate}
            >
              {episode.title}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ReaderIndexPanel({
  activeTab,
  stories,
  volumes,
  currentStoryId,
  imageEpisodes,
  currentEpisodeId,
  tocView,
  onTocViewChange,
  basePath,
  onNavigate,
  bookmarks,
  bookmarksEnabled,
  bookmarksLoading,
  onJumpToBookmark,
  headings,
  activeHeadingLine,
  onJumpToHeading,
}: {
  activeTab: "story" | "image";
  stories: ReaderStory[];
  volumes: ReaderVolume[];
  currentStoryId?: string;
  imageEpisodes: StorytellerImageEpisodeMock[];
  currentEpisodeId?: string;
  tocView: "title" | "thumbnail";
  onTocViewChange: (view: "title" | "thumbnail") => void;
  basePath: string;
  onNavigate?: () => void;
  bookmarks: StorytellerStoryBookmarkWithStory[];
  bookmarksEnabled: boolean;
  bookmarksLoading: boolean;
  onJumpToBookmark: (bookmark: StorytellerStoryBookmarkWithStory) => void;
  headings: StoryHeading[];
  activeHeadingLine?: number;
  onJumpToHeading: (heading: StoryHeading) => void;
}) {
  return activeTab === "story" ? (
    <StoryIndexPanel
      stories={stories}
      volumes={volumes}
      currentStoryId={currentStoryId}
      basePath={basePath}
      onNavigate={onNavigate}
      bookmarks={bookmarks}
      bookmarksEnabled={bookmarksEnabled}
      bookmarksLoading={bookmarksLoading}
      onJumpToBookmark={onJumpToBookmark}
      headings={headings}
      activeHeadingLine={activeHeadingLine}
      onJumpToHeading={onJumpToHeading}
    />
  ) : (
    <ImageIndexPanel
      episodes={imageEpisodes}
      currentEpisodeId={currentEpisodeId}
      basePath={basePath}
      tocView={tocView}
      onTocViewChange={onTocViewChange}
      onNavigate={onNavigate}
    />
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
        ...steamPanelTopBarSx,
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
  footnoteNumbering,
  footnoteIdPrefix,
}: {
  content: string;
  bookmarkedLines: Set<number>;
  pendingLines: Set<number>;
  bookmarkMode: BookmarkMode;
  highlightedLine?: number;
  onToggleBookmark: (lineIndex: number) => void;
  // 整篇故事共用的腳注編號＋DOM id 前綴（見 StorytellerWysiwygMarkdown 的
  // footnoteNumbering／footnoteIdPrefix 說明）——這裡逐行渲染，每一行都要用同一份，
  // 不能讓每行各自算，不然編號會從 1 重來、腳注清單也會每行各渲染一次。
  footnoteNumbering: FootnoteNumbering;
  footnoteIdPrefix: string;
}) {
  const lines = content.split("\n");
  return (
    <Stack spacing={0.25}>
      {lines.map((line, index) => {
        // 新版內容每行都會被 marker 包住（例如 `⟦id⟧⟦/id⟧`），就算段落本身是空的，
        // 原始字串也不會是空字串——用解析結果的實際文字判斷是不是空行，而不是直接看
        // 原始字串是否為空白，不然舊資料的空行間距（用來排版）在遷移後會失效。
        const isBlankLine = parseMarkdownToParagraphs(line)[0].runs.every(
          (run) => run.text.trim() === "",
        );
        if (isBlankLine) {
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
              <StorytellerWysiwygMarkdown
                footnoteNumbering={footnoteNumbering}
                footnoteIdPrefix={footnoteIdPrefix}
                showFootnoteSection={false}
              >
                {line}
              </StorytellerWysiwygMarkdown>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default function StorytellerReader({
  forcedTab,
}: {
  // 每條路由都是具名、不重疊的（.../stories、.../story/:storyId、.../images、
  // .../image/:episodeId），不需要再靠網址片段猜要顯示哪個 tab，註冊路由時直接指定。
  forcedTab: "story" | "image";
}) {
  const { session, loading: authLoading } = useAuth();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { shareToken } = params;
  const routeEpisodeId = params.episodeId;
  const routeStoryId = params.storyId;
  const routeProjectPath = params.projectPath;
  const activeTab = forcedTab;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // 切故事/圖像 tab 是靠 navigate() 換路由觸發整個元件重新渲染（甚至重新掛載），
  // 用 useTransition 包起來，才能在畫面還沒切換完成前顯示 loading，不會讓使用者
  // 覺得點了沒反應；就算目前資料都是同步取得、幾乎感覺不到延遲，之後圖像作品接上
  // 真正的後端 API 時，這裡也不用再改。
  const [isTabPending, startTabTransition] = useTransition();
  const [indexOpen, setIndexOpen] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [pendingBookmarkLines, setPendingBookmarkLines] = useState<Set<number>>(
    new Set(),
  );
  const [bookmarkSnackbar, setBookmarkSnackbar] = useState<{
    open: boolean;
    message: string;
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
        path: steamloomPath(`work/${apiProject.public_id}-${apiProject.slug}`),
        authorUserId: apiProject.user_id,
        authorPenName: apiProject.author?.pen_name,
        rating: apiProject.rating,
        tags: apiProject.tags ?? [],
        wordCount: (apiProject.stories ?? []).reduce(
          (total, story) => total + story.word_count,
          0,
        ),
        stories: flattenGroupedStories(
          apiProject.stories ?? [],
          apiProject.volumes ?? [],
        ).map((story) => ({
          id: story.public_id,
          title: story.title,
          summary: story.summary,
          content: story.latest_content,
          sort: story.sort,
          updatedAt: story.updated_at,
          parentId: story.parent_id,
        })),
        volumes: [...(apiProject.volumes ?? [])]
          .sort((left, right) => left.sort - right.sort)
          .map((volume) => ({ id: volume.id, title: volume.title })),
      }
    : undefined;
  const stories = project?.stories ?? [];
  const volumes = project?.volumes ?? [];
  const imageEpisodes = listImageEpisodes(project?.id);
  const tocView: "title" | "thumbnail" =
    searchParams.get("tocView") === "thumbnail" ? "thumbnail" : "title";
  const currentStoryId = routeStoryId;
  const currentStory = currentStoryId
    ? stories.find((story) => story.id === currentStoryId)
    : activeTab === "story"
      ? (stories.find((story) => story.sort === 0) ?? stories[0])
      : undefined;
  const currentStoryIndex = currentStory
    ? stories.findIndex((story) => story.id === currentStory.id)
    : -1;
  const previousStory =
    currentStoryIndex > 0 ? stories[currentStoryIndex - 1] : undefined;
  const nextStory =
    currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1
      ? stories[currentStoryIndex + 1]
      : undefined;
  const currentEpisode = routeEpisodeId
    ? imageEpisodes.find((episode) => episode.id === routeEpisodeId)
    : activeTab === "image"
      ? imageEpisodes[0]
      : undefined;
  const currentEpisodeIndex = currentEpisode
    ? imageEpisodes.findIndex((episode) => episode.id === currentEpisode.id)
    : -1;
  const previousEpisode =
    currentEpisodeIndex > 0
      ? imageEpisodes[currentEpisodeIndex - 1]
      : undefined;
  const nextEpisode =
    currentEpisodeIndex >= 0 && currentEpisodeIndex < imageEpisodes.length - 1
      ? imageEpisodes[currentEpisodeIndex + 1]
      : undefined;
  const totalEpisodePages = currentEpisode?.pageDataUrls.length ?? 0;
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
      .map((bookmark) => bookmark.line_index),
  );
  const bookmarkMode: BookmarkMode = isHistoricalView
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
    setPageIndex(0);
  }, [currentEpisode?.id]);
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
  // 側欄「本篇大綱」捲動高亮：取「目前閱讀行」（畫面頂端往下 READING_LINE_OFFSET 處）
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
    const READING_LINE_OFFSET = 96;
    let frame: number | null = null;
    function updateActiveHeading() {
      frame = null;
      let current = elements[0].lineIndex;
      for (const item of elements) {
        if (item.el.getBoundingClientRect().top <= READING_LINE_OFFSET) {
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

  // 分享連結沒有圖像家族、也沒有明確的 /stories 區段（維持原本簡單的
  // work/share/:token[/:storyId] 形狀），只有一般閱讀連結才會用到 stories/images/story
  // 這幾個明確區段。
  const canonicalPathSuffix = routeEpisodeId
    ? `/image/${routeEpisodeId}`
    : currentStoryId
      ? isShareRoute
        ? `/${currentStoryId}`
        : `/story/${currentStoryId}`
      : isShareRoute
        ? ""
        : activeTab === "image"
          ? "/images"
          : "/stories";
  useTitle(
    project
      ? `${project.name} - ${STORYTELLER_APP_NAME}`
      : STORYTELLER_APP_NAME,
    {
      description: shouldUseStorySeo ? project?.description : undefined,
      path: routeProjectPath
        ? steamloomPath(`work/${routeProjectPath}${canonicalPathSuffix}`)
        : shareToken
          ? steamloomPath(`work/share/${shareToken}${canonicalPathSuffix}`)
          : "",
      robots:
        isShareRoute || isPrivateOwnerRoute
          ? "noindex, nofollow"
          : "index, follow",
      type: shouldUseStorySeo ? "article" : "website",
    },
  );

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

  const basePath = isShareRoute
    ? steamloomPath(`work/share/${shareToken}`)
    : project.path;
  // 點外層故事/圖像 tab 直接導去對應家族的路由（.../stories 或 .../images），
  // 讓該路由自己的 forcedTab 決定要顯示哪個 tab 的第一篇內容；分享連結沒有圖像家族，
  // 一律導回故事列表。
  function handleTabChange(tab: "story" | "image") {
    startTabTransition(() => {
      if (isShareRoute) {
        navigate(steamloomPath(`work/share/${shareToken}`));
        return;
      }
      navigate(`${basePath}/${tab === "image" ? "images" : "stories"}`);
    });
  }
  function handleTocViewChange(view: "title" | "thumbnail") {
    const next = new URLSearchParams(searchParams);
    next.set("tocView", view);
    setSearchParams(next);
  }
  function goToImagePage(index: number) {
    setPageIndex(Math.min(Math.max(index, 0), totalEpisodePages - 1));
  }
  const handleJumpToBookmark = (
    bookmark: StorytellerStoryBookmarkWithStory,
  ) => {
    const isStale =
      bookmark.story_version_id !== bookmark.latest_story_version_id;
    setHistoricalVersionId(isStale ? bookmark.story_version_id : undefined);
    setPendingScroll({ lineIndex: bookmark.line_index, block: "center" });
    if (bookmark.story_public_id !== currentStory?.id) {
      navigate(`${basePath}/story/${bookmark.story_public_id}`);
    }
  };
  // 標題有自己的錨點 id（見 storyHeadingAnchorId），跟書籤不同，不用透過 pendingScroll
  // 這一層共用狀態繞一圈——直接找到錨點元素捲過去就好。
  const handleJumpToHeading = (heading: StoryHeading) => {
    // 直接樂觀更新，不用等捲動完成後 scroll-spy 自己抓到，點擊當下就先反白。
    setActiveHeadingLine(heading.lineIndex);
    document
      .getElementById(heading.anchorId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showInlineIndex = !isMobile && indexOpen;
  // 收藏／收藏作者／評分控制項，供頂端功能列與右下角快速選單共用。
  // 原作看自己的故事時這幾個按鈕改成「顯示但 disabled」而不是整段隱藏，
  // 讓原作也能看到收藏數／收藏作者數／評分人數與平均分，只是不能對自己按讚評分。
  const favoriteCount = apiProject?.favorite_count ?? 0;
  const authorFollowerCount = apiProject?.author?.follower_count ?? 0;
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
            saveFavorite.mutate(!isFavorited);
            return;
          }
          setFavorite((value) => !value);
        }}
      >
        {isFavorited ? "已收藏" : "收藏"}（{favoriteCount}）
      </Button>
      {project.authorUserId && (
        <Button
          variant={isAuthorFavorited ? "contained" : "outlined"}
          startIcon={
            isAuthorFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />
          }
          disabled={isOwner || saveAuthorFavorite.isPending}
          onClick={() => {
            if (!session) {
              setLoginPromptOpen(true);
              return;
            }
            saveAuthorFavorite.mutate(!isAuthorFavorited);
          }}
        >
          {isAuthorFavorited ? "已收藏作者" : "收藏作者"}（{authorFollowerCount}
          ）
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
            disabled={isOwner || saveRanking.isPending}
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
          {projectRatingCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {projectRatingCount} 人・平均 {projectAverageRating.toFixed(1)}
            </Typography>
          )}
        </Stack>
      </Paper>
    </>
  );
  const readerBody = (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 1,
        ...steamLedgerEdgeSx,
      }}
    >
      {activeTab === "image" ? (
        currentEpisode ? (
          <Stack spacing={2}>
            <Box>
              <Typography component="h1" variant="h4" fontWeight={800}>
                {currentEpisode.title}
              </Typography>
              {currentEpisode.summary && (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {currentEpisode.summary}
                </Typography>
              )}
              <StorytellerTagChips tags={currentEpisode.tags} sx={{ mt: 1 }} />
            </Box>
            <Divider />
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Chip
                  size="small"
                  label="圖像閱讀 Mockup"
                  color="warning"
                  variant="outlined"
                />
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
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Box
                  component="img"
                  src={currentEpisode.pageDataUrls[pageIndex]}
                  alt={`第 ${pageIndex + 1} 頁`}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    display: "block",
                  }}
                />
                <Box
                  onClick={() => goToImagePage(pageIndex - 1)}
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: "50%",
                    cursor: pageIndex > 0 ? "pointer" : "default",
                  }}
                />
                <Box
                  onClick={() => goToImagePage(pageIndex + 1)}
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "50%",
                    cursor:
                      pageIndex < totalEpisodePages - 1 ? "pointer" : "default",
                  }}
                />
              </Box>
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
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {currentEpisode.pageDataUrls.map((url, index) => (
                  <Box
                    key={index}
                    component="img"
                    src={url}
                    alt={`縮圖 ${index + 1}`}
                    onClick={() => goToImagePage(index)}
                    sx={{
                      width: 56,
                      height: 76,
                      objectFit: "cover",
                      borderRadius: 0.5,
                      cursor: "pointer",
                      border: "2px solid",
                      borderColor:
                        index === pageIndex ? "primary.main" : "transparent",
                    }}
                  />
                ))}
              </Stack>
            </Stack>
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
                  label="上一話"
                  title={previousEpisode?.title ?? "沒有上一話"}
                  to={
                    previousEpisode
                      ? `${basePath}/image/${previousEpisode.id}`
                      : undefined
                  }
                  disabled={!previousEpisode}
                  align="left"
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <ChapterNavCard
                  label="本話"
                  title={currentEpisode.title}
                  align="center"
                  disabled
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <ChapterNavCard
                  label="下一話"
                  title={nextEpisode?.title ?? "沒有下一話"}
                  to={
                    nextEpisode
                      ? `${basePath}/image/${nextEpisode.id}`
                      : undefined
                  }
                  disabled={!nextEpisode}
                  align="right"
                />
              </Box>
            </Box>
          </Stack>
        ) : (
          <Typography color="text.secondary">目前還沒有圖像作品。</Typography>
        )
      ) : currentStory ? (
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
                      color: versionListOpen
                        ? "primary.main"
                        : "text.secondary",
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
                              to: `${basePath}/story/${currentStory.id}/versions/${version.id}`,
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
                  to={steamloomPath(
                    `user/${encodeURIComponent(project.authorPenName)}`,
                  )}
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
              footnoteNumbering={footnoteNumbering}
              footnoteIdPrefix={footnoteIdPrefix}
            />
            {/* 腳注固定放在整篇故事的最尾端，跟內容裡有沒有標題、標題怎麼分段無關——
                所以是在這裡（逐行內容渲染完之後）渲染一次，不是讓上面每一行各自渲染。 */}
            <StorytellerFootnoteSection
              list={footnoteNumbering.list}
              idPrefix={footnoteIdPrefix}
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
                  previousStory
                    ? `${basePath}/story/${previousStory.id}`
                    : undefined
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
                to={nextStory ? `${basePath}/story/${nextStory.id}` : undefined}
                disabled={!nextStory}
                align="right"
              />
            </Box>
          </Box>
        </Stack>
      ) : (
        <Typography color="text.secondary">目前還沒有故事作品。</Typography>
      )}
    </Paper>
  );

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: project.name },
      ]}
      meta={
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
              to={steamloomPath(
                `user/${encodeURIComponent(project.authorPenName)}`,
              )}
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
          {imageEpisodes.length > 0 && (
            <Chip
              label={`${imageEpisodes.length} 話`}
              variant="outlined"
              icon={<CollectionsIcon fontSize="small" />}
            />
          )}
          <Box sx={{ flexBasis: "100%" }}>
            <StorytellerTagChips tags={project.tags} sx={{ mt: 1 }} />
          </Box>
        </>
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
                aria-label="關閉索引"
                onClick={() => setMobileIndexOpen(false)}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <ReaderIndexPanel
              activeTab={activeTab}
              stories={stories}
              volumes={volumes}
              currentStoryId={currentStory?.id}
              imageEpisodes={imageEpisodes}
              currentEpisodeId={currentEpisode?.id}
              tocView={tocView}
              onTocViewChange={handleTocViewChange}
              basePath={basePath}
              onNavigate={() => setMobileIndexOpen(false)}
              bookmarks={projectBookmarks}
              bookmarksEnabled={Boolean(session)}
              bookmarksLoading={projectBookmarksQuery.isLoading}
              onJumpToBookmark={handleJumpToBookmark}
              headings={storyHeadings}
              activeHeadingLine={activeHeadingLine}
              onJumpToHeading={handleJumpToHeading}
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
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          <Button
            variant="outlined"
            startIcon={<MenuBookIcon />}
            onClick={() =>
              isMobile
                ? setMobileIndexOpen(true)
                : setIndexOpen((open) => !open)
            }
          >
            {isMobile ? "開啟索引" : indexOpen ? "收起索引" : "展開索引"}
          </Button>
          {!isShareRoute && (
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup
                value={activeTab}
                exclusive
                disabled={isTabPending}
                onChange={(_, value: "story" | "image" | null) =>
                  value && handleTabChange(value)
                }
                color="primary"
              >
                <ToggleButton value="story" sx={{ px: 2.5, fontWeight: 700 }}>
                  <AutoStoriesIcon fontSize="small" sx={{ mr: 1 }} />
                  故事
                </ToggleButton>
                <ToggleButton value="image" sx={{ px: 2.5, fontWeight: 700 }}>
                  <CollectionsIcon fontSize="small" sx={{ mr: 1 }} />
                  圖像
                </ToggleButton>
              </ToggleButtonGroup>
              {isTabPending && <CircularProgress size={20} />}
            </Stack>
          )}
        </Stack>
        {(currentStory || currentEpisode) && (
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
        onClose={() =>
          setBookmarkSnackbar((prev) => ({ ...prev, open: false }))
        }
      />

      {/* 頂端功能列捲出畫面後，右下角出現快速按鈕：行動版可開索引，收藏與評分快速選單原作也看得到（顯示但 disabled） */}
      {(currentStory || currentEpisode) && (
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
                  aria-label="開啟索引"
                  onClick={() => setMobileIndexOpen(true)}
                >
                  <MenuBookIcon />
                </Fab>
              </Zoom>
            )}
            <Zoom in={!actionBarVisible}>
              <Fab
                color="primary"
                size="medium"
                aria-label="開啟收藏與評分選單"
                onClick={(event) => setQuickActionsAnchor(event.currentTarget)}
              >
                {isFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
              </Fab>
            </Zoom>
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
          description="此創作專案標示為限制級，請確認你已年滿 18 歲後再繼續閱讀。"
          leaveTo={steamloomPath()}
          panelTitle="限制級創作專案"
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
                  <ReaderIndexPanel
                    activeTab={activeTab}
                    stories={stories}
                    volumes={volumes}
                    currentStoryId={currentStory?.id}
                    imageEpisodes={imageEpisodes}
                    currentEpisodeId={currentEpisode?.id}
                    tocView={tocView}
                    onTocViewChange={handleTocViewChange}
                    basePath={basePath}
                    bookmarks={projectBookmarks}
                    bookmarksEnabled={Boolean(session)}
                    bookmarksLoading={projectBookmarksQuery.isLoading}
                    onJumpToBookmark={handleJumpToBookmark}
                    headings={storyHeadings}
                    activeHeadingLine={activeHeadingLine}
                    onJumpToHeading={handleJumpToHeading}
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
                <ReaderIndexPanel
                  activeTab={activeTab}
                  stories={stories}
                  volumes={volumes}
                  currentStoryId={currentStory?.id}
                  imageEpisodes={imageEpisodes}
                  currentEpisodeId={currentEpisode?.id}
                  tocView={tocView}
                  onTocViewChange={handleTocViewChange}
                  basePath={basePath}
                  bookmarks={projectBookmarks}
                  bookmarksEnabled={Boolean(session)}
                  bookmarksLoading={projectBookmarksQuery.isLoading}
                  onJumpToBookmark={handleJumpToBookmark}
                  headings={storyHeadings}
                  activeHeadingLine={activeHeadingLine}
                  onJumpToHeading={handleJumpToHeading}
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
