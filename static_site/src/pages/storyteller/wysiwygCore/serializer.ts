import type { JSONContent } from "@tiptap/core";

import {
  ASSET_URI_PREFIX,
  blockKindPrefix,
  DEFAULT_ALIGNMENT,
  DEFAULT_ASSET_IMAGE_LAYOUT,
  DEFAULT_ASSET_IMAGE_SIZE,
  DEFAULT_BLOCK_KIND,
  DEFAULT_COMMENT_COLOR,
  DEFAULT_HEADING_LEVEL,
  escapeMarkerComment,
  escapeTableCell,
  MARKER_ALIGN_ATTR,
  MARKER_BG_COLOR_ATTR,
  MARKER_CLOSE,
  MARKER_CLOSE_SLASH,
  MARKER_COMMENT_ATTR,
  MARKER_COMMENT_COLOR_ATTR,
  MARKER_HREF_ATTR,
  MARKER_NOTE_ATTR,
  MARKER_OPEN,
  MARKER_TARGET_ATTR,
  MARKER_TEXT_COLOR_ATTR,
  generateInlineMarkerId,
  MARK_SYNTAX_WHITELIST,
  normalizeAssetImageLayout,
  normalizeAssetImageSize,
  sanitizeMarkdownImageAlt,
  TABLE_MARKER_NAME,
  TABLE_MARKER_ROW_ID_ATTR,
  TABLE_MARKER_TABLE_ID_ATTR,
  type BlockKindValue,
  type CommentColorValue,
  type HeadingLevel,
  type MarkName,
} from "./whitelist";
import { assetImageTitle } from "./assetImageLayout";

const CANONICAL_DELIMITER: Record<MarkName, string> = Object.fromEntries(
  MARK_SYNTAX_WHITELIST.map((rule) => [rule.markName, rule.canonicalDelimiter]),
) as Record<MarkName, string>;

/** 由外而內包住文字的順序，決定多重樣式重疊時 delimiter 的巢狀順序。 */
const MARK_NESTING_ORDER_OUTER_TO_INNER: MarkName[] = [
  "bold",
  "underline",
  "strike",
  "italic",
  "subscript",
  "superscript",
];

// 一個「行內包裝」：可能是純開關樣式的 delimiter（粗體等，開/關字串一樣），
// 也可能是帶值的行內 marker——span（文字顏色，開 `⟦span-id ...⟧`、關 `⟦/span-id⟧`）、
// a（連結，開 `⟦a-id href="..." target="..."⟧`、關 `⟦/a-id⟧`）、footnote（腳注，開
// `⟦footnote-id note="..."⟧`、關 `⟦/footnote-id⟧`），或 comment（註解，開
// `⟦comment-id comment="..." commentColor="..."⟧`、關 `⟦/comment-id⟧`）——皆沒有 id
// 屬性，id 只在序列化時產生。
type InlineWrapper =
  | { kind: "delimiter"; mark: MarkName }
  | { kind: "span"; textColor?: string; bgColor?: string }
  | { kind: "a"; href: string; target?: string }
  | { kind: "footnote"; note: string }
  | { kind: "comment"; comment: string; commentColor: CommentColorValue };

/**
 * 讀出這個文字節點要套的所有包裝，由外而內排序：comment（註解）最外層，接著 footnote
 * （腳注），再來 span（顏色），接著 a（連結），delimiter 樣式（粗體等）最內層。順序只是
 * 為了序列化輸出穩定（同樣的格式每次存檔都長一樣），解析端不假設任何順序，任何巢狀順序
 * 都讀得出來。
 */
function wrappersOf(node: JSONContent): InlineWrapper[] {
  const marks = node.marks ?? [];
  let textColor: string | undefined;
  let bgColor: string | undefined;
  let href: string | undefined;
  let target: string | undefined;
  let footnoteNote: string | undefined;
  let commentText: string | undefined;
  let commentColor: CommentColorValue | undefined;
  for (const mark of marks) {
    if (mark.type === "textColor") {
      textColor = mark.attrs?.value as string | undefined;
    } else if (mark.type === "bgColor") {
      bgColor = mark.attrs?.value as string | undefined;
    } else if (mark.type === "link") {
      href = mark.attrs?.href as string | undefined;
      target = (mark.attrs?.target as string | undefined) || undefined;
    } else if (mark.type === "footnote") {
      footnoteNote = (mark.attrs?.note as string | undefined) ?? "";
    } else if (mark.type === "comment") {
      commentText = (mark.attrs?.comment as string | undefined) ?? "";
      commentColor =
        (mark.attrs?.commentColor as CommentColorValue | undefined) ??
        DEFAULT_COMMENT_COLOR;
    }
  }

  const wrappers: InlineWrapper[] = [];
  if (commentText !== undefined) {
    wrappers.push({
      kind: "comment",
      comment: commentText,
      commentColor: commentColor ?? DEFAULT_COMMENT_COLOR,
    });
  }
  if (footnoteNote !== undefined) {
    wrappers.push({ kind: "footnote", note: footnoteNote });
  }
  if (textColor || bgColor) {
    wrappers.push({ kind: "span", textColor, bgColor });
  }
  if (href) {
    wrappers.push({ kind: "a", href, target });
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
  if (a.kind === "a" && b.kind === "a") {
    return a.href === b.href && a.target === b.target;
  }
  if (a.kind === "footnote" && b.kind === "footnote") {
    return a.note === b.note;
  }
  if (a.kind === "comment" && b.kind === "comment") {
    return a.comment === b.comment && a.commentColor === b.commentColor;
  }
  return false;
}

/** 展開一個包裝，回傳輸出字串跟（span／a／footnote／comment 才有的）本次產生的 id，關閉時要用同一個 id。 */
function openWrapper(wrapper: InlineWrapper): {
  text: string;
  id: string | null;
} {
  if (wrapper.kind === "delimiter") {
    return { text: CANONICAL_DELIMITER[wrapper.mark], id: null };
  }
  if (wrapper.kind === "span") {
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
  if (wrapper.kind === "a") {
    const id = generateInlineMarkerId("a");
    // href 是自由格式值，不像顏色是固定 enum，一定要跳脫才能安全塞進屬性字串。
    const hrefAttr = ` ${MARKER_HREF_ATTR}="${escapeMarkerComment(wrapper.href)}"`;
    const targetAttr = wrapper.target
      ? ` ${MARKER_TARGET_ATTR}="${wrapper.target}"`
      : "";
    return {
      text: `${MARKER_OPEN}${id}${hrefAttr}${targetAttr}${MARKER_CLOSE}`,
      id,
    };
  }
  if (wrapper.kind === "footnote") {
    const id = generateInlineMarkerId("footnote");
    const noteAttr = ` ${MARKER_NOTE_ATTR}="${escapeMarkerComment(wrapper.note)}"`;
    return {
      text: `${MARKER_OPEN}${id}${noteAttr}${MARKER_CLOSE}`,
      id,
    };
  }
  const id = generateInlineMarkerId("comment");
  const commentAttr = ` ${MARKER_COMMENT_ATTR}="${escapeMarkerComment(wrapper.comment)}"`;
  // commentColor 是預設色時省略不輸出（省略即代表預設色），比照原本段落屬性時代的規則。
  const commentColorAttr =
    wrapper.commentColor !== DEFAULT_COMMENT_COLOR
      ? ` ${MARKER_COMMENT_COLOR_ATTR}="${wrapper.commentColor}"`
      : "";
  return {
    text: `${MARKER_OPEN}${id}${commentAttr}${commentColorAttr}${MARKER_CLOSE}`,
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
  const inlineNodes = (paragraph.content ?? []).filter(
    (node) => node.type === "text" || node.type === "assetImage",
  );

  let output = "";
  let openStack: InlineWrapper[] = [];
  let openIds: (string | null)[] = [];

  for (const node of inlineNodes) {
    if (node.type === "assetImage") {
      for (let i = openStack.length - 1; i >= 0; i--) {
        output += closeWrapper(openStack[i], openIds[i]);
      }
      openStack = [];
      openIds = [];
      const alt = sanitizeMarkdownImageAlt(String(node.attrs?.alt ?? ""));
      const publicId = String(node.attrs?.publicId ?? "");
      const src = publicId
        ? `${ASSET_URI_PREFIX}${publicId}`
        : String(node.attrs?.src ?? "");
      const layout = normalizeAssetImageLayout(
        node.attrs?.layout ?? DEFAULT_ASSET_IMAGE_LAYOUT,
      );
      const size = normalizeAssetImageSize(
        node.attrs?.size ?? DEFAULT_ASSET_IMAGE_SIZE,
      );
      const caption = String(node.attrs?.caption ?? "");
      output += `![${alt}](${src}${assetImageTitle(layout, size, caption)})`;
      continue;
    }

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

// align 是段落 marker 開始標記上的屬性（不是行首前綴），要跟 parser.ts 的 MARKER_PATTERN
// 對稱。標題仍然是行首前綴，因為那是沿用大家熟悉的 markdown 慣例，跟 align 這種
// 「無論如何都要自創語法」的情況不同。註解（comment）2026-07-09 起改成行內 marker
// （見 wrappersOf 的 "comment" kind），不再是段落屬性。
//
// 引用/清單（blockKind）2026-07-10 起也走行首前綴，跟標題互斥——這裡只會輸出其中一種
// 前綴（標題優先），就算編輯器不知怎麼讓兩個屬性同時非預設值，序列化這一關也不會把
// 兩個前綴都寫出來，這是最後一道防線（真正的互斥保證在 markerParagraph.ts 的
// setHeadingLevel／setBlockKind 命令，見那邊的說明）。
function serializeParagraph(paragraph: JSONContent): string {
  const markerId = (paragraph.attrs?.markerId as string | null) ?? "";
  const align =
    (paragraph.attrs?.textAlign as string | undefined) ?? DEFAULT_ALIGNMENT;
  const headingLevel =
    (paragraph.attrs?.headingLevel as HeadingLevel | undefined) ??
    DEFAULT_HEADING_LEVEL;
  const blockKind =
    (paragraph.attrs?.blockKind as BlockKindValue | undefined) ??
    DEFAULT_BLOCK_KIND;
  const prefix =
    headingLevel > 0
      ? `${"#".repeat(headingLevel)} `
      : blockKindPrefix(blockKind);
  const alignAttr =
    align !== DEFAULT_ALIGNMENT ? ` ${MARKER_ALIGN_ATTR}="${align}"` : "";
  const inline = serializeParagraphInline(paragraph);
  return `${prefix}${MARKER_OPEN}${markerId}${alignAttr}${MARKER_CLOSE}${inline}${MARKER_OPEN}${MARKER_CLOSE_SLASH}${markerId}${MARKER_CLOSE}`;
}

function serializeTable(table: JSONContent, tableIndex: number): string[] {
  const tableId =
    (table.attrs?.tableId as string | null | undefined) ??
    `tbl_${tableIndex + 1}`;
  return (table.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row, rowIndex) => {
      const rowId =
        (row.attrs?.rowId as string | null | undefined) ??
        `row_${rowIndex + 1}`;
      const cells = (row.content ?? [])
        .filter((cell) => cell.type === "tableCell")
        .map((cell) => escapeTableCell(serializeParagraphInline(cell).trim()));
      const rowText = `| ${cells.join(" | ")} |`;
      return (
        `${MARKER_OPEN}${TABLE_MARKER_NAME} ` +
        `${TABLE_MARKER_TABLE_ID_ATTR}="${escapeMarkerComment(tableId)}" ` +
        `${TABLE_MARKER_ROW_ID_ATTR}="${escapeMarkerComment(rowId)}"` +
        `${MARKER_CLOSE}${rowText}${MARKER_OPEN}${MARKER_CLOSE_SLASH}${TABLE_MARKER_NAME}${MARKER_CLOSE}`
      );
    });
}

function serializeCodeBlock(codeBlock: JSONContent): string[] {
  const markerId = ((codeBlock.attrs?.markerId as string | null) ?? "").trim();
  const language = ((codeBlock.attrs?.language as string | null) ?? "").trim();
  const languagePart = language ? language : "";
  const idPart = markerId
    ? `${languagePart ? " " : " "}id="${escapeMarkerComment(markerId)}"`
    : "";
  const content = (codeBlock.content ?? [])
    .filter((node) => node.type === "text")
    .map((node) => node.text ?? "")
    .join("");
  return [`\`\`\`${languagePart}${idPart}`, content, "```"];
}

/**
 * 把 Tiptap 的 doc JSON 序列化成白名單規則下的自訂 markdown 字串。
 * 段落之間用單一 `\n` 接（不是空行），跟 parseMarkdownToParagraphs 的 split("\n") 對稱，
 * 也是為了讓 content.split("\n") 的陣列位置跟書籤 line_index／版本 diff 保持一致。
 */
export function serializeDocToMarkdown(doc: JSONContent): string {
  const lines: string[] = [];
  (doc.content ?? []).forEach((node, nodeIndex) => {
    if (node.type === "paragraph") {
      lines.push(serializeParagraph(node));
    } else if (node.type === "storytellerCodeBlock") {
      lines.push(...serializeCodeBlock(node));
    } else if (node.type === "storytellerTable") {
      lines.push(...serializeTable(node, nodeIndex));
    }
  });
  return lines.join("\n");
}
