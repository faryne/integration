import type { JSONContent } from "@tiptap/core";

import {
  DEFAULT_ALIGNMENT,
  DEFAULT_COMMENT_COLOR,
  DEFAULT_HEADING_LEVEL,
  MARKER_ALIGN_ATTR,
  MARKER_BG_COLOR_ATTR,
  MARKER_CLOSE,
  MARKER_CLOSE_SLASH,
  MARKER_COMMENT_ATTR,
  MARKER_COMMENT_COLOR_ATTR,
  MARKER_OPEN,
  MARKER_TEXT_COLOR_ATTR,
  MARK_SYNTAX_WHITELIST,
  escapeMarkerComment,
  generateInlineMarkerId,
  type CommentColorValue,
  type HeadingLevel,
  type MarkName,
} from "./whitelist";

const CANONICAL_DELIMITER: Record<MarkName, string> = Object.fromEntries(
  MARK_SYNTAX_WHITELIST.map((rule) => [rule.markName, rule.canonicalDelimiter]),
) as Record<MarkName, string>;

/** 由外而內包住文字的順序，決定多重樣式重疊時 delimiter 的巢狀順序。 */
const MARK_NESTING_ORDER_OUTER_TO_INNER: MarkName[] = [
  "bold",
  "underline",
  "italic",
  "subscript",
  "superscript",
];

// 一個「行內包裝」：可能是純開關樣式的 delimiter（粗體等，開/關字串一樣），
// 也可能是帶值的 span 行內 marker（文字顏色，開 `⟦span-id ...⟧`、關 `⟦/span-id⟧`）。
type InlineWrapper =
  | { kind: "delimiter"; mark: MarkName }
  | { kind: "span"; textColor?: string; bgColor?: string };

/** 讀出這個文字節點要套的所有包裝，由外而內排序：span（顏色）在最外層、delimiter 樣式在內層。 */
function wrappersOf(node: JSONContent): InlineWrapper[] {
  const marks = node.marks ?? [];
  let textColor: string | undefined;
  let bgColor: string | undefined;
  for (const mark of marks) {
    if (mark.type === "textColor") {
      textColor = mark.attrs?.value as string | undefined;
    } else if (mark.type === "bgColor") {
      bgColor = mark.attrs?.value as string | undefined;
    }
  }

  const wrappers: InlineWrapper[] = [];
  if (textColor || bgColor) {
    wrappers.push({ kind: "span", textColor, bgColor });
  }
  const present = new Set(marks.map((mark) => mark.type as MarkName));
  for (const mark of MARK_NESTING_ORDER_OUTER_TO_INNER) {
    if (present.has(mark)) {
      wrappers.push({ kind: "delimiter", mark });
    }
  }
  return wrappers;
}

function wrappersEqual(a: InlineWrapper, b: InlineWrapper): boolean {
  if (a.kind === "delimiter" && b.kind === "delimiter") {
    return a.mark === b.mark;
  }
  if (a.kind === "span" && b.kind === "span") {
    return a.textColor === b.textColor && a.bgColor === b.bgColor;
  }
  return false;
}

/** 展開一個包裝，回傳輸出字串跟（span 才有的）本次產生的 id，關閉時要用同一個 id。 */
function openWrapper(wrapper: InlineWrapper): {
  text: string;
  id: string | null;
} {
  if (wrapper.kind === "delimiter") {
    return { text: CANONICAL_DELIMITER[wrapper.mark], id: null };
  }
  const id = generateInlineMarkerId("span");
  const textColorAttr = wrapper.textColor
    ? ` ${MARKER_TEXT_COLOR_ATTR}="${wrapper.textColor}"`
    : "";
  const bgColorAttr = wrapper.bgColor
    ? ` ${MARKER_BG_COLOR_ATTR}="${wrapper.bgColor}"`
    : "";
  return {
    text: `${MARKER_OPEN}${id}${textColorAttr}${bgColorAttr}${MARKER_CLOSE}`,
    id,
  };
}

function closeWrapper(wrapper: InlineWrapper, id: string | null): string {
  if (wrapper.kind === "delimiter") {
    return CANONICAL_DELIMITER[wrapper.mark];
  }
  return `${MARKER_OPEN}${MARKER_CLOSE_SLASH}${id}${MARKER_CLOSE}`;
}

/**
 * 相鄰的文字節點如果共用某個外層包裝（例如兩個都在同一個粗體範圍內，只有中間一段多了斜體；
 * 或兩段共用同一個紅字顏色），不能每個節點各自重複開/關（`**a****b**` 會讓解析器誤判巢狀結構）。
 * 這裡維護一個「目前展開中的包裝堆疊」，跟下一個節點要的包裝做前綴比對，只關閉/開啟真正變動的部分。
 * 純開關 delimiter 跟帶值 span 行內 marker 都走同一套堆疊邏輯（span 開/關時記得帶上同一個 id）。
 */
function serializeParagraphInline(paragraph: JSONContent): string {
  const textNodes = (paragraph.content ?? []).filter(
    (node) => node.type === "text",
  );

  let output = "";
  let openStack: InlineWrapper[] = [];
  let openIds: (string | null)[] = [];

  for (const node of textNodes) {
    const target = wrappersOf(node);

    let commonLength = 0;
    while (
      commonLength < openStack.length &&
      commonLength < target.length &&
      wrappersEqual(openStack[commonLength], target[commonLength])
    ) {
      commonLength++;
    }

    for (let i = openStack.length - 1; i >= commonLength; i--) {
      output += closeWrapper(openStack[i], openIds[i]);
    }

    const nextIds = openIds.slice(0, commonLength);
    for (let i = commonLength; i < target.length; i++) {
      const opened = openWrapper(target[i]);
      output += opened.text;
      nextIds[i] = opened.id;
    }

    output += node.text ?? "";
    openStack = target;
    openIds = nextIds;
  }

  for (let i = openStack.length - 1; i >= 0; i--) {
    output += closeWrapper(openStack[i], openIds[i]);
  }

  return output;
}

// align／comment／commentColor 都是 marker 開始標記上的屬性（不是行首前綴），固定順序
// align、comment、commentColor，要跟 parser.ts 的 MARKER_PATTERN 對稱。標題仍然是行首前綴，
// 因為那是沿用大家熟悉的 markdown 慣例，跟 align/comment 這種「無論如何都要自創語法」的情況不同。
function serializeParagraph(paragraph: JSONContent): string {
  const markerId = (paragraph.attrs?.markerId as string | null) ?? "";
  const align =
    (paragraph.attrs?.textAlign as string | undefined) ?? DEFAULT_ALIGNMENT;
  const headingLevel =
    (paragraph.attrs?.headingLevel as HeadingLevel | undefined) ??
    DEFAULT_HEADING_LEVEL;
  const comment = (paragraph.attrs?.comment as string | null) ?? null;
  const commentColor =
    (paragraph.attrs?.commentColor as CommentColorValue | null) ?? null;
  const headingPrefix = headingLevel > 0 ? `${"#".repeat(headingLevel)} ` : "";
  const alignAttr =
    align !== DEFAULT_ALIGNMENT ? ` ${MARKER_ALIGN_ATTR}="${align}"` : "";
  const commentAttr = comment
    ? ` ${MARKER_COMMENT_ATTR}="${escapeMarkerComment(comment)}"`
    : "";
  // commentColor 沒有 comment 時不輸出；有 comment 但顏色是預設色時也不輸出（省略即代表預設色）。
  const commentColorAttr =
    comment && commentColor && commentColor !== DEFAULT_COMMENT_COLOR
      ? ` ${MARKER_COMMENT_COLOR_ATTR}="${commentColor}"`
      : "";
  const inline = serializeParagraphInline(paragraph);
  return `${headingPrefix}${MARKER_OPEN}${markerId}${alignAttr}${commentAttr}${commentColorAttr}${MARKER_CLOSE}${inline}${MARKER_OPEN}${MARKER_CLOSE_SLASH}${markerId}${MARKER_CLOSE}`;
}

/**
 * 把 Tiptap 的 doc JSON 序列化成白名單規則下的自訂 markdown 字串。
 * 段落之間用單一 `\n` 接（不是空行），跟 parseMarkdownToParagraphs 的 split("\n") 對稱，
 * 也是為了讓 content.split("\n") 的陣列位置跟書籤 line_index／版本 diff 保持一致。
 */
export function serializeDocToMarkdown(doc: JSONContent): string {
  return (doc.content ?? [])
    .filter((node) => node.type === "paragraph")
    .map(serializeParagraph)
    .join("\n");
}
