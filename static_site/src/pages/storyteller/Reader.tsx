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
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
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
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
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
              還沒有加入任何書籤，閱讀時點擊每行左側或圖像頁的書籤圖示即可加入。
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

// 跨內容類型（故事／圖像／未來新增的類型）共用的作品標頭：標題、簡介、作者、
// 最後更新時間。新增內容類型時應該一律沿用這個元件，不要各自刻一份標頭版面。
function ContentMetaHeader({
  title,
  titleRef,
  summary,
  authorPenName,
  updatedAt,
  rightAction,
  children,
}: {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  summary?: string;
  authorPenName?: string;
  updatedAt: string;
  rightAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
      >
        <Typography
          ref={titleRef}
          component="h1"
          variant="h4"
          fontWeight={800}
          sx={{ scrollMarginTop: 24 }}
        >
          {title}
        </Typography>
        {rightAction}
      </Stack>
      {summary && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {summary}
        </Typography>
      )}
      {children}
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
  // 逐行預先解析一次：isBlank 沿用原本判斷空行的邏輯（新版內容每行都被 marker 包住，
  // 就算段落本身是空的，原始字串也不會是空字串，要用解析結果的實際文字判斷，不是看
  // 原始字串是否為空白，不然舊資料的空行間距在遷移後會失效）；orderedListStart 是這一行
  // 在目前這串連續有序清單裡排第幾個——原生 <ol> 沒辦法跨越逐行渲染的多個
  // StorytellerWysiwygMarkdown 實例接續編號（每個實例天生只有一個 <li>），所以自己算好
  // 傳進去，讓它用 <ol start={N}> 補回視覺上的連續編號（見該元件的 orderedListStart 說明）。
  // 兩者共用同一次 parseMarkdownToParagraphs 呼叫，跟下面的 JSX .map() 分開算好、避免
  // 邏輯重複一份、也避免在 render callback 裡放 mutable 變數。
  // 用一般 for 迴圈直接在這個函式的作用域裡累加，不透過 .map() 的 callback 閉包改外層
  // 變數——React Compiler 的靜態分析會把「在 callback 裡改外層變數」當成不安全的
  // render 期間 mutation 擋下來，一般 for 迴圈就不會有這個問題。
  const parsedLines: { isBlank: boolean; orderedListStart: number }[] = [];
  let orderedListRunLength = 0;
  for (const line of lines) {
    const paragraph = parseMarkdownToParagraphs(line)[0];
    const isBlank = paragraph.runs.every(
      (run) => !run.assetSrc && !run.assetPublicId && run.text.trim() === "",
    );
    orderedListRunLength =
      !isBlank && paragraph.blockKind === "number"
        ? orderedListRunLength + 1
        : 0;
    parsedLines.push({ isBlank, orderedListStart: orderedListRunLength });
  }
  return (
    <Stack spacing={0.25}>
      {lines.map((line, index) => {
        const { isBlank: isBlankLine, orderedListStart } = parsedLines[index];
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
                orderedListStart={orderedListStart || undefined}
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

export default function StorytellerReader() {
  const { session, loading: authLoading } = useAuth();
  const params = useParams();
  const location = useLocation();
  const { shareToken } = params;
  const routeEpisodeId = params.episodeId;
  const routeStoryId = params.storyId;
  const routeProjectPath = params.projectPath;
  const consumedImageHashRef = useRef<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [indexOpen, setIndexOpen] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  // 目前這張圖是否已經載入完成——圖片頁切換時（換頁或換話）重置，載入完成前顯示
  // loading，避免容器高度因為圖片還沒下載完、瀏覽器抓不到尺寸而跳動。
  const [currentPageLoaded, setCurrentPageLoaded] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
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
  const handleToggleBookmark = (lineIndex: number) => {
    if (!session) {
      setLoginPromptOpen(true);
      return;
    }
    if (
      !displayVersionId ||
      !currentItem ||
      pendingBookmarkLines.has(lineIndex)
    ) {
      return;
    }
    const isBookmarked = bookmarkedLines.has(lineIndex);
    if (isHistoricalView && !isBookmarked) {
      return;
    }
    setPendingBookmarkLines((prev) => new Set(prev).add(lineIndex));
    const lineId = String(lineIndex);
    const mutationOptions = {
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
    if (pendingDeleteBookmarkIds.has(bookmark.id)) {
      return;
    }
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
        },
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
    storyStartRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentItem?.id]);

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
  }, [currentItem?.id, isOwner]);

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
    document
      .getElementById(heading.anchorId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showInlineIndex = !isMobile && indexOpen;
  // 追蹤專案／追蹤作者／評分控制項，放在 Hero Card 的互動列，右下角快速選單
  // （頂端功能列捲出畫面後）也共用同一組。原作看自己的故事時這幾個按鈕改成
  // 「顯示但 disabled」而不是整段隱藏，讓原作也能看到追蹤數／評分人數與平均分，
  // 只是不能對自己按讚評分。
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
            saveAuthorFavorite.mutate(!isAuthorFavorited);
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
      {currentEpisode ? (
        <Stack spacing={2}>
          <ContentMetaHeader
            title={currentEpisode.title}
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
                label="上一篇"
                title={previousItem?.title ?? "沒有上一篇"}
                to={previousItem ? itemHref(basePath, previousItem) : undefined}
                disabled={!previousItem}
                align="left"
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="本篇"
                title={currentEpisode.title}
                align="center"
                disabled
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="下一篇"
                title={nextItem?.title ?? "沒有下一篇"}
                to={nextItem ? itemHref(basePath, nextItem) : undefined}
                disabled={!nextItem}
                align="right"
              />
            </Box>
          </Box>
        </Stack>
      ) : currentStory ? (
        <Stack spacing={2}>
          <ContentMetaHeader
            title={currentStory.title}
            titleRef={storyStartRef}
            summary={currentStory.summary}
            authorPenName={project.authorPenName}
            updatedAt={currentStory.updatedAt}
            rightAction={
              !isOwner && (
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
              )
            }
          >
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
          </ContentMetaHeader>
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
                label="上一篇"
                title={previousItem?.title ?? "沒有上一篇"}
                to={previousItem ? itemHref(basePath, previousItem) : undefined}
                disabled={!previousItem}
                align="left"
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="本篇"
                title={currentStory.title}
                align="center"
                disabled
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <ChapterNavCard
                label="下一篇"
                title={nextItem?.title ?? "沒有下一篇"}
                to={nextItem ? itemHref(basePath, nextItem) : undefined}
                disabled={!nextItem}
                align="right"
              />
            </Box>
          </Box>
        </Stack>
      ) : (
        <Typography color="text.secondary">目前還沒有任何作品。</Typography>
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
              items={items}
              volumes={volumes}
              currentItemId={currentItem?.id}
              basePath={basePath}
              onNavigate={() => setMobileIndexOpen(false)}
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
      )}

      <Stack
        ref={actionBarRef}
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Button
          variant="outlined"
          startIcon={<MenuBookIcon />}
          onClick={() =>
            isMobile ? setMobileIndexOpen(true) : setIndexOpen((open) => !open)
          }
        >
          {isMobile ? "開啟索引" : indexOpen ? "收起索引" : "展開索引"}
        </Button>
      </Stack>

      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="追蹤專案、追蹤作者、評分故事或加入書籤需要登入。是否要現在登入？"
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
                    items={items}
                    volumes={volumes}
                    currentItemId={currentItem?.id}
                    basePath={basePath}
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
                  items={items}
                  volumes={volumes}
                  currentItemId={currentItem?.id}
                  basePath={basePath}
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
