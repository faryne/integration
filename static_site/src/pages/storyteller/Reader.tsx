import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
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
import type { Ref } from "react";
import {
  StorytellerFootnoteSection,
  StorytellerWysiwygMarkdown,
} from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  computeFootnoteNumbering,
  groupParagraphsByBlockKind,
  parseMarkdownToParagraphs,
  storyHeadingAnchorId,
  type FootnoteNumbering,
} from "@/pages/storyteller/wysiwygCore/parser.ts";
import type { HeadingLevel } from "@/pages/storyteller/wysiwygCore/whitelist.ts";
import { flattenGroupedStories } from "@/pages/storyteller/storytellerVolumes.ts";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  useStorytellerProject,
  useCreateStorytellerStoryBookmark,
  useDeleteStorytellerStoryBookmark,
  usePublicStorytellerImageStoryPages,
  usePublicStorytellerStoryLatestVersion,
  usePublicStorytellerStoryVersions,
  useSaveStorytellerAuthorFavorite,
  useSaveStorytellerProjectFavorite,
  useSaveStorytellerProjectRanking,
  usePublicStorytellerProject,
  useSharedStorytellerImageStoryPages,
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
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerReaderToolbar } from "@/pages/storyteller/StorytellerReaderToolbar.tsx";
import { StorytellerReaderHistory } from "@/pages/storyteller/StorytellerReaderHistory.tsx";
import { useStorytellerHeaderContext } from "@/layouts/StorytellerHeaderContext.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import {
  READER_FONT_FAMILIES,
  useStorytellerReaderPreferences,
} from "@/pages/storyteller/useStorytellerReaderPreferences.ts";
import type { StorytellerStoryBookmarkWithStory } from "@/types/storyteller.ts";

// ReaderItem 是故事與話（圖像作品）合併後的統一序列元素——冊現在是通用容器，
// 兩種類型可以混著放在同一冊裡，閱讀頁不再分開兩個家族，只依 sort／冊順序
// 排成一條連續的序列，用 contentType 決定要用哪種方式渲染本文。
interface ReaderItem {
  id: string;
  contentType: "text" | "image";
  title: string;
  summary: string;
  content: string;
  sort: number;
  updatedAt: string;
  // 所屬冊的 id，null 代表未分冊；只用來在索引分組顯示，不影響上一篇/下一篇導覽
  // （導覽沿用 items 陣列本身已經是「依冊順序、未分冊排最後」排好的線性順序）。
  parentId: number | null;
}

interface ReaderVolume {
  id: number;
  title: string;
}

interface ReaderImagePage {
  id: string;
  imageUrl: string;
  description: string;
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
  items: ReaderItem[];
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

// itemHref 依內容類型組出對應的路由片段——文字故事跟話的 URL 區段不同
// （/story/:id vs /image/:id），但在同一份索引／導覽序列裡混著出現。
function itemHref(basePath: string, item: ReaderItem) {
  return `${basePath}/${item.contentType === "image" ? "image" : "story"}/${item.id}`;
}

function ContentIndex({
  items,
  volumes,
  currentItemId,
  basePath,
  onNavigate,
}: {
  items: ReaderItem[];
  volumes: ReaderVolume[];
  currentItemId?: string;
  basePath: string;
  onNavigate?: () => void;
}) {
  // items 本身已經是「依冊順序、未分冊排最後」排好的線性順序（見
  // flattenGroupedStories），編號直接用這個順序的 index，分組只是視覺上加標題/分隔線，
  // 不影響編號，讀者看到的序號跟上一篇/下一篇導覽會是同一套。
  function itemIndexLabel(item: ReaderItem) {
    return items.findIndex((candidate) => candidate.id === item.id) + 1;
  }
  const currentVolumeId =
    items.find((item) => item.id === currentItemId)?.parentId ?? null;
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

  function ItemButton({ item }: { item: ReaderItem }) {
    return (
      <Button
        key={item.id}
        component={RouterLink}
        to={itemHref(basePath, item)}
        variant={currentItemId === item.id ? "contained" : "text"}
        startIcon={
          item.contentType === "image" ? (
            <CollectionsIcon fontSize="small" />
          ) : (
            <ArticleIcon fontSize="small" />
          )
        }
        sx={{ justifyContent: "flex-start", textAlign: "left" }}
        onClick={onNavigate}
      >
        {itemIndexLabel(item)}. {item.title}
      </Button>
    );
  }

  const ungrouped = items.filter((item) => item.parentId === null);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AutoStoriesIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>
          作品索引
        </Typography>
      </Stack>
      <Divider />
      {volumes.map((volume) => {
        const children = items.filter((item) => item.parentId === volume.id);
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
                {children.map((item) => (
                  <ItemButton key={item.id} item={item} />
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
                未分冊作品
              </Typography>
            </>
          )}
          {ungrouped.map((item) => (
            <ItemButton key={item.id} item={item} />
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

// 頁面描述本身是 whitelist markdown（含 marker 屬性、粗體斜體等語法），列表預覽只需要
// 純文字片段，不能直接把原始字串塞進 Typography——會連 [markerId] 這種內部標記語法都
// 原樣顯示出來。用跟 extractStoryHeadings 抽標題文字一樣的做法：解析成段落後只取每個
// run 的 text，marks／marker 屬性都會在解析階段被拆掉，不會出現在結果字串裡。
function plainTextFromMarkdown(content: string): string {
  return parseMarkdownToParagraphs(content)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join(" ")
    .trim();
}

// 圖像作品版的「本篇大綱」——沒有標題可抽，改成列出每一頁的縮圖（沿用已經載入、
// 簽過名的 imageUrl，不用另外拉縮圖資源）跟描述前幾個字，點擊直接跳頁。
function ImagePageOutline({
  pages,
  activeIndex,
  onJumpToPage,
}: {
  pages: ReaderImagePage[];
  activeIndex: number;
  onJumpToPage: (index: number) => void;
}) {
  return (
    <Stack spacing={0.5}>
      {pages.map((page, index) => {
        const isActive = index === activeIndex;
        const description = plainTextFromMarkdown(page.description);
        return (
          <Paper
            key={page.id}
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: 1,
              cursor: "pointer",
              bgcolor: isActive ? "action.selected" : undefined,
              borderColor: isActive ? "primary.main" : undefined,
            }}
            onClick={() => onJumpToPage(index)}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                component="img"
                src={page.imageUrl}
                alt={`第 ${index + 1} 頁`}
                sx={{
                  width: 40,
                  height: 54,
                  objectFit: "cover",
                  borderRadius: 0.5,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  color={isActive ? "primary.main" : "text.secondary"}
                  fontWeight={isActive ? 700 : 400}
                  sx={{ display: "block" }}
                >
                  第 {index + 1} 頁
                </Typography>
                {description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {description}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

function ReaderIndexPanel({
  items,
  volumes,
  currentItemId,
  basePath,
  onNavigate,
  bookmarks,
  bookmarksEnabled,
  bookmarksLoading,
  onJumpToBookmark,
  onDeleteBookmark,
  pendingDeleteBookmarkIds,
  headings,
  activeHeadingLine,
  onJumpToHeading,
  imagePages,
  activeImagePageIndex,
  onJumpToImagePage,
}: {
  items: ReaderItem[];
  volumes: ReaderVolume[];
  currentItemId?: string;
  basePath: string;
  onNavigate?: () => void;
  bookmarks: StorytellerStoryBookmarkWithStory[];
  bookmarksEnabled: boolean;
  bookmarksLoading: boolean;
  onJumpToBookmark: (bookmark: StorytellerStoryBookmarkWithStory) => void;
  onDeleteBookmark: (bookmark: StorytellerStoryBookmarkWithStory) => void;
  pendingDeleteBookmarkIds: Set<number>;
  headings: StoryHeading[];
  activeHeadingLine?: number;
  onJumpToHeading: (heading: StoryHeading) => void;
  imagePages: ReaderImagePage[];
  activeImagePageIndex: number;
  onJumpToImagePage: (index: number) => void;
}) {
  const [tab, setTab] = useState<"toc" | "bookmarks" | "outline">("toc");
  // 文字故事用標題抽「本篇大綱」，圖像作品沒有標題，改用頁面清單當「頁面一覽」——
  // 兩者互斥（一個 item 只會是其中一種內容類型），共用同一個分頁槽位，只是內容跟
  // 標籤依目前是哪種類型決定。
  const hasOutline = headings.length > 0 || imagePages.length > 0;
  const outlineLabel = imagePages.length > 0 ? "頁面一覽" : "本篇大綱";
  useEffect(() => {
    // 切到沒有標題／頁面可列的內容時，大綱分頁會消失，這時候如果還停在該分頁要退回
    // 目錄，不然畫面會變成沒有任何分頁按鈕顯示為選取中。
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
            {outlineLabel}
          </Button>
        )}
      </Stack>
      {tab === "toc" ? (
        <ContentIndex
          items={items}
          volumes={volumes}
          currentItemId={currentItemId}
          basePath={basePath}
          onNavigate={onNavigate}
        />
      ) : tab === "outline" && imagePages.length > 0 ? (
        <ImagePageOutline
          pages={imagePages}
          activeIndex={activeImagePageIndex}
          onJumpToPage={(index) => {
            onJumpToImagePage(index);
            onNavigate?.();
          }}
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
              還沒有加入任何書籤。文字作品請開啟「編輯書籤」，圖像作品可使用頁面上的書籤按鈕。
            </Typography>
          ) : (
            bookmarks.map((bookmark) => {
              const item = items.find(
                (candidate) => candidate.id === bookmark.story_public_id,
              );
              const isImage = bookmark.content_type === "image";
              const isStale = isImage
                ? (bookmark.page_sort ?? -1) < 0
                : bookmark.story_version_id !==
                  bookmark.latest_story_version_id;
              const lineText = (bookmark.line_preview ?? "").trim();
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    {isImage && bookmark.thumbnail_url && (
                      <Box
                        component="img"
                        src={bookmark.thumbnail_url}
                        alt={item?.title ?? bookmark.story_title}
                        sx={{
                          width: 40,
                          height: 54,
                          objectFit: "cover",
                          borderRadius: 0.5,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
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
                          {item?.title ?? bookmark.story_title}
                        </Typography>
                        {isStale && (
                          <Chip
                            size="small"
                            label={isImage ? "頁面已移除" : "非最新版本"}
                            color="warning"
                            variant="outlined"
                            sx={{ height: 18, fontSize: 11 }}
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {isImage
                          ? isStale
                            ? "（書籤指向的頁面已被刪除）"
                            : `第 ${(bookmark.page_sort ?? 0) + 1} 頁`
                          : snippet || "（空白段落）"}
                      </Typography>
                    </Box>
                    <Tooltip title="刪除書籤">
                      <span>
                        <IconButton
                          size="small"
                          disabled={pendingDeleteBookmarkIds.has(bookmark.id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteBookmark(bookmark);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              );
            })
          )}
        </Stack>
      )}
    </Stack>
  );
}

// 比照 YouTube 播放器的進度列：滑鼠移到軌道上的某個位置會浮出該頁的縮圖預覽，點擊
// 直接跳到那一頁。頁面是離散的（不是連續時間），滑鼠位置會吸附到最近的一頁，不會有
// 「中間值」。頁數只有 1 頁時沒有可跳的地方，直接不渲染。
function ImagePageScrubber({
  pages,
  currentIndex,
  onJump,
}: {
  pages: ReaderImagePage[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const total = pages.length;

  function indexFromPointer(clientX: number): number {
    const track = trackRef.current;
    if (!track || total <= 1) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(Math.max(Math.round(ratio * (total - 1)), 0), total - 1);
  }

  if (total <= 1) {
    return null;
  }

  const hoverPage = hoverIndex !== null ? pages[hoverIndex] : null;
  const percentOf = (index: number) => (index / (total - 1)) * 100;

  return (
    <Box sx={{ position: "relative" }}>
      {hoverPage && hoverIndex !== null && (
        <Box
          sx={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: `${percentOf(hoverIndex)}%`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              width: 84,
              overflow: "hidden",
              borderRadius: 1,
              borderWidth: 2,
              borderColor: "primary.main",
              boxShadow: 3,
            }}
          >
            <Box
              component="img"
              src={hoverPage.imageUrl}
              alt={`第 ${hoverIndex + 1} 頁預覽`}
              sx={{
                width: "100%",
                height: 112,
                objectFit: "cover",
                display: "block",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "center",
                py: 0.25,
                bgcolor: "background.paper",
              }}
            >
              第 {hoverIndex + 1} 頁
            </Typography>
          </Paper>
        </Box>
      )}
      <Box
        ref={trackRef}
        onMouseMove={(event) => setHoverIndex(indexFromPointer(event.clientX))}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={(event) => onJump(indexFromPointer(event.clientX))}
        sx={{
          position: "relative",
          height: 20,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: 6,
            borderRadius: 3,
            bgcolor: "action.disabledBackground",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${percentOf(currentIndex)}%`,
              bgcolor: "primary.main",
              transition: "width .12s",
            }}
          />
        </Box>
        {pages.map((page, index) => (
          <Box
            key={page.id}
            sx={{
              position: "absolute",
              left: `${percentOf(index)}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: index === currentIndex ? 12 : 8,
              height: index === currentIndex ? 12 : 8,
              borderRadius: "50%",
              bgcolor:
                index === currentIndex
                  ? "primary.main"
                  : index < currentIndex
                    ? "primary.light"
                    : "background.paper",
              border: "2px solid",
              borderColor: index === currentIndex ? "primary.main" : "divider",
              pointerEvents: "none",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

// 跨內容類型（故事／圖像／未來新增的類型）共用的作品標頭：標題、簡介、作者、
// 最後更新時間。新增內容類型時應該一律沿用這個元件，不要各自刻一份標頭版面。
function ContentMetaHeader({
  title,
  titleRef,
  summary,
  authorPenName,
  updatedAt,
}: {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  summary?: string;
  authorPenName?: string;
  updatedAt: string;
}) {
  return (
    <Box>
      <Typography
        ref={titleRef}
        component="h1"
        variant="h4"
        fontWeight={800}
        sx={{ scrollMarginTop: 80 }}
      >
        {title}
      </Typography>
      {summary && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {summary}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: 1 }}
      >
        {authorPenName && (
          <Typography
            variant="caption"
            color="primary"
            component={RouterLink}
            to={steamloomPath(`user/${encodeURIComponent(authorPenName)}`)}
            sx={{
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            作者 {authorPenName}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          更新於 {formatStorytellerDate(updatedAt)}
        </Typography>
      </Stack>
    </Box>
  );
}

type BookmarkMode = "full" | "removeOnly" | "none";

/**
 * 書籤／捲動高亮／DOM 錨點的定位單位是「渲染分組」（見 groupParagraphsByBlockKind），
 * 不是原始行號：一般段落/標題（blockKind "none"）永遠各自獨立成一組，locator 就是它
 * 自己那一行；引用/清單/表格/分隔線這類會合併成一組的，locator 是這一組第一行的原始
 * 行號——跟 StorytellerWysiwygMarkdown 在閱讀頁把這些行合併渲染成一個
 * <blockquote>/<ul>/<table> 的分組結果完全一致，書籤／書籤預覽（Go 後端的
 * groupStoryLinesByBlockKind）、捲動跳轉三邊都要用同一套規則，不然書籤會停在跟畫面上
 * 看到的分組對不起來的位置。2026-08-09 起從「逐行」改成「逐組」，理由：以前每行各自
 * 一個書籤按鈕，對著表格裡的某一列下書籤會很怪（見設計討論）；有序清單也因此不再需要
 * orderedListStart 接續 hack——整組清單現在一次交給一個 StorytellerWysiwygMarkdown
 * 實例渲染，原生 <ol> 自己就能連續編號。
 */
function StoryContentLines({
  content,
  bookmarkedLines,
  pendingLines,
  bookmarkMode,
  bookmarkEditing,
  highlightedLine,
  onToggleBookmark,
  footnoteNumbering,
  footnoteIdPrefix,
}: {
  content: string;
  bookmarkedLines: Set<number>;
  pendingLines: Set<number>;
  bookmarkMode: BookmarkMode;
  bookmarkEditing: boolean;
  highlightedLine?: number;
  onToggleBookmark: (groupIndex: number) => void;
  // 整篇故事共用的腳注編號＋DOM id 前綴（見 StorytellerWysiwygMarkdown 的
  // footnoteNumbering／footnoteIdPrefix 說明）——這裡逐組渲染，每一組都要用同一份，
  // 不能讓每組各自算，不然編號會從 1 重來、腳注清單也會每組各渲染一次。
  footnoteNumbering: FootnoteNumbering;
  footnoteIdPrefix: string;
}) {
  const lines = content.split("\n");
  const groups = groupParagraphsByBlockKind(parseMarkdownToParagraphs(content));
  return (
    <Box
      sx={{
        // 這層不能用 Stack：每個故事段落會變成獨立 flex item，使前一段的浮動圖片
        // 無法影響後續段落。改回同一個 block formatting context，並保留原本 2px 間距。
        "& > :not(style) ~ :not(style)": { mt: 0.25 },
      }}
    >
      {groups.map((group) => {
        const groupIndex = group.items[0].index;
        // 空行判斷沿用原本邏輯（新版內容每行都被 marker 包住，就算段落本身是空的，原始
        // 字串也不會是空字串，要用解析結果的實際文字判斷）——只有 "none" 分組（單行）
        // 才可能是純粹的空行間距，引用/清單/表格這類多行分組不會是空行，不需要判斷。
        if (group.blockKind === "none") {
          const isBlank = group.items[0].paragraph.runs.every(
            (run) =>
              !run.assetSrc && !run.assetPublicId && run.text.trim() === "",
          );
          if (isBlank) {
            return <Box key={groupIndex} sx={{ height: 12 }} />;
          }
        }
        const isBookmarked = bookmarkedLines.has(groupIndex);
        const showEditAction =
          bookmarkEditing &&
          (bookmarkMode === "full" ||
            (bookmarkMode === "removeOnly" && isBookmarked));
        const groupContent =
          group.blockKind === "code"
            ? lines
                .slice(
                  groupIndex,
                  groupIndex + (group.items[0].paragraph.sourceLineCount ?? 1),
                )
                .join("\n")
            : group.items.map(({ index }) => lines[index]).join("\n");
        return (
          <Box
            key={groupIndex}
            id={`bookmark-line-${groupIndex}`}
            sx={{
              position: "relative",
              borderRadius: 1,
              transition: "background-color .6s",
              bgcolor:
                highlightedLine === groupIndex ? "action.selected" : undefined,
            }}
          >
            {(isBookmarked || showEditAction) && (
              <Box
                sx={{
                  position: {
                    xs: showEditAction ? "static" : "absolute",
                    sm: "absolute",
                  },
                  top: { xs: showEditAction ? undefined : 2, sm: 2 },
                  right: {
                    xs: showEditAction ? undefined : "calc(100% + 4px)",
                    sm: "calc(100% + 10px)",
                  },
                  mb: { xs: showEditAction ? 1 : 0, sm: 0 },
                  display: "flex",
                  justifyContent: "flex-start",
                }}
              >
                {showEditAction ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      isBookmarked ? (
                        <BookmarkIcon fontSize="small" />
                      ) : (
                        <BookmarkBorderIcon fontSize="small" />
                      )
                    }
                    disabled={pendingLines.has(groupIndex)}
                    onClick={() => onToggleBookmark(groupIndex)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {isBookmarked ? "移除書籤" : "加入書籤"}
                  </Button>
                ) : (
                  <Box
                    component="span"
                    role="img"
                    aria-label="已加入書籤"
                    sx={{
                      width: 30,
                      height: 30,
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                    }}
                  >
                    <BookmarkIcon fontSize="small" />
                  </Box>
                )}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <StorytellerWysiwygMarkdown
                footnoteNumbering={footnoteNumbering}
                footnoteIdPrefix={footnoteIdPrefix}
                showFootnoteSection={false}
              >
                {groupContent}
              </StorytellerWysiwygMarkdown>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// 閱讀 context 已合併進全站 AppBar，不再另外疊第二列；跳轉時只需避開 Header。
const READER_STICKY_OFFSET = 84;

export default function StorytellerReader() {
  const { setReader: setHeaderReader } = useStorytellerHeaderContext();
  const { session, loading: authLoading } = useAuth();
  const params = useParams();
  const location = useLocation();
  const { shareToken } = params;
  const routeEpisodeId = params.episodeId;
  const routeStoryId = params.storyId;
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
  const readerBodyRef = useRef<HTMLDivElement | null>(null);
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
        })),
        volumes: [...(apiProject.volumes ?? [])]
          .sort((left, right) => left.sort - right.sort)
          .map((volume) => ({ id: volume.id, title: volume.title })),
      }
    : undefined;
  const items = project?.items ?? [];
  const volumes = project?.volumes ?? [];
  // 故事與話已經合併成同一份依序排列的序列，不再分兩個家族——目前在看哪一篇，
  // 直接看網址帶的 storyId 或 episodeId（兩種 URL 區段都還在，只是不影響排序跟
  // 上一篇/下一篇導覽了），都沒有就預設第一篇。
  const currentItemId = routeStoryId ?? routeEpisodeId;
  const currentItem = currentItemId
    ? items.find((item) => item.id === currentItemId)
    : items[0];
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
            visible: readerContextVisible,
          }
        : undefined,
    );
  }, [
    currentItem?.id,
    currentItem?.summary,
    currentItem?.title,
    project?.name,
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

  // 分享連結沒有明確的 /stories 區段（維持原本簡單的 work/share/:token[/:storyId]
  // 形狀），只有一般閱讀連結才會用到 stories/story/image 這幾個明確區段。故事跟話
  // 已經合併成同一份序列，不再有 /images 這個獨立家族入口。
  const canonicalPathSuffix = routeEpisodeId
    ? `/image/${routeEpisodeId}`
    : routeStoryId
      ? isShareRoute
        ? `/${routeStoryId}`
        : `/story/${routeStoryId}`
      : isShareRoute
        ? ""
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
    const node = readerBodyRef.current;
    if (!node) {
      return;
    }
    let frame: number | null = null;
    const updateProgress = () => {
      const bodyTop = node.getBoundingClientRect().top + window.scrollY;
      const bottomSpacerHeight =
        node.querySelector<HTMLElement>("[data-reader-bottom-spacer]")
          ?.offsetHeight ?? 0;
      const scrollableHeight = Math.max(
        node.offsetHeight - bottomSpacerHeight - window.innerHeight,
        1,
      );
      const next = Math.min(
        100,
        Math.max(0, ((window.scrollY - bodyTop) / scrollableHeight) * 100),
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
  }, [currentItem?.id, displayVersionId, pageIndex, currentPageLoaded]);

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

  // /image/:episodeId#[頁面 id] 深連結：頁面清單載入完成後，找到 hash 對應的頁面
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

  const basePath = isShareRoute
    ? steamloomPath(`work/share/${shareToken}`)
    : project.path;
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
        `${basePath}/image/${bookmark.story_public_id}#${encodeURIComponent(bookmark.line_id)}`,
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
      navigate(`${basePath}/story/${bookmark.story_public_id}`);
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
            const nextAuthorFavorited = !isAuthorFavorited;
            saveAuthorFavorite.mutate(nextAuthorFavorited, {
              onSuccess: () => {
                setBookmarkSnackbar({
                  open: true,
                  message: nextAuthorFavorited
                    ? "已追蹤此作者"
                    : "已取消追蹤此作者",
                });
              },
              onError: () =>
                setBookmarkSnackbar({
                  open: true,
                  message: "作者追蹤狀態更新失敗，請重試。",
                  severity: "error",
                }),
            });
          }}
        >
          {isAuthorFavorited ? "已追蹤作者" : "追蹤作者"}（{authorFollowerCount}
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
  const projectDetails = (
    <Stack spacing={1.5}>
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
      ref={readerBodyRef}
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
            authorPenName={project.authorPenName}
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
            authorPenName={project.authorPenName}
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
          <Box
            sx={{
              typography: "body1",
              fontFamily: READER_FONT_FAMILIES[preferences.fontFamily],
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
              maxWidth: preferences.measure,
              width: "100%",
              alignSelf: "center",
              boxSizing: "border-box",
              px: { xs: 1.5, sm: 0 },
              "& h1": { typography: "h5", fontWeight: 800 },
              "& h2": { typography: "h6", fontWeight: 800, mt: 3 },
              "& p, & li, & blockquote, & td, & th": {
                fontSize: "inherit",
                lineHeight: "inherit",
              },
              "& p": { my: 0.5 },
            }}
          >
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
          </Box>
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

  return (
    <StorytellerShell
      title={project.name}
      hideHeading={Boolean(currentItem)}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: project.name },
      ]}
    >
      <GlobalStyles
        styles={{
          "body footer": {
            paddingBottom:
              "calc(88px + env(safe-area-inset-bottom)) !important",
          },
        }}
      />
      <StorytellerReaderToolbar
        projectName={project.name}
        currentTitle={currentItem?.title}
        progress={readingProgress}
        navigationOpen={indexOpen}
        onOpenNavigation={() => setIndexOpen(true)}
        projectDetails={projectDetails}
        bookmarkEditing={bookmarkEditing}
        bookmarkEditingAvailable={Boolean(
          currentStory && bookmarkMode !== "none",
        )}
        onToggleBookmarkEditing={() =>
          setBookmarkEditing((editing) => !editing)
        }
        renderHistory={
          currentStory
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
          previousItem
            ? {
                title: previousItem.title,
                href: itemHref(basePath, previousItem),
              }
            : undefined
        }
        nextChapter={
          nextItem
            ? { title: nextItem.title, href: itemHref(basePath, nextItem) }
            : undefined
        }
        preferences={preferences}
        onChangePreferences={updatePreferences}
      />

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
          {readerBody}
        </AgeConfirmationGate>
      ) : (
        <>{readerBody}</>
      )}
    </StorytellerShell>
  );
}
