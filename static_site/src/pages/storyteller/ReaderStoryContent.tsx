import type { BookmarkMode } from "@/pages/storyteller/readerModel.ts";
import { StorytellerWysiwygMarkdown } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  groupParagraphsByBlockKind,
  parseMarkdownToParagraphs,
  type FootnoteNumbering,
} from "@/pages/storyteller/wysiwygCore/parser.ts";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import { Box, Button } from "@mui/material";
import type { ReactNode } from "react";
import {
  TYPOGRAPHY_FONT_FAMILIES,
  type StorytellerTypographyPreferences,
} from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";

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
export function StoryContentLines({
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

// 閱讀頁文字內容的排版外框：字體、字級、行距、欄寬都吃讀者的閱讀設定。
// 故事本文與設定頁共用，兩邊的閱讀手感才會一致。
export function ReaderTextFrame({
  preferences,
  children,
}: {
  preferences: StorytellerTypographyPreferences;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        typography: "body1",
        fontFamily: TYPOGRAPHY_FONT_FAMILIES[preferences.fontFamily],
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
      {children}
    </Box>
  );
}
