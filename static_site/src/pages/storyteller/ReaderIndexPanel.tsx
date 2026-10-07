import { readerStoryPath } from "@/helpers/storytellerReaderPaths.ts";
import {
  plainTextFromMarkdown,
  type ReaderImagePage,
  type ReaderItem,
  type ReaderVolume,
  type StoryHeading,
} from "@/pages/storyteller/readerModel.ts";
import type { StorytellerStoryBookmarkWithStory } from "@/types/storyteller.ts";
import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

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
  // 序號改成「每一冊自己重新從 1 算」，不再沿用 flattenGroupedStories 給的
  // 全域線性順序——主線、支線這類語意不同的冊如果編號直接接下去（主線
  // 1 話接著支線變成 2 話），讀者會誤以為是同一條時間線，所以顯示用的序號
  // 交給下面 children.map／ungrouped.map 各自從 1 開始算。items 本身的全域
  // 順序還是原封不動保留，上一篇／下一篇導覽（見 currentItemIndex）不受影響。
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

  function ItemButton({ item, index }: { item: ReaderItem; index: number }) {
    return (
      <Button
        key={item.id}
        component={RouterLink}
        to={readerStoryPath(basePath, item.id)}
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
        {index}. {item.title}
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
                {children.map((item, index) => (
                  <ItemButton key={item.id} item={item} index={index + 1} />
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
          {ungrouped.map((item, index) => (
            <ItemButton key={item.id} item={item} index={index + 1} />
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

export function ReaderIndexPanel({
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
