import type { JSONContent } from "@tiptap/core";

import {
  ALIGN_BLOCK_CLOSE,
  ALIGN_BLOCK_OPEN,
  DEFAULT_ALIGNMENT,
  DEFAULT_HEADING_LEVEL,
  MARKER_CLOSE,
  MARKER_CLOSE_SLASH,
  MARKER_COMMENT_ATTR,
  MARKER_OPEN,
  MARK_SYNTAX_WHITELIST,
  escapeMarkerComment,
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

function orderedMarksOf(node: JSONContent): MarkName[] {
  const present = new Set((node.marks ?? []).map((mark) => mark.type as MarkName));
  return MARK_NESTING_ORDER_OUTER_TO_INNER.filter((mark) => present.has(mark));
}

/**
 * 相鄰的文字節點如果共用某個外層樣式（例如兩個都在同一個粗體範圍內，只有中間一段多了斜體），
 * 不能每個節點各自重複開/關該樣式的 delimiter（`**a****b**` 這種寫法會讓解析器誤判巢狀結構）。
 * 這裡用一個「目前展開中的樣式堆疊」跟下一個節點要的樣式做前綴比對，只關閉/開啟真正變動的部分。
 */
function serializeParagraphInline(paragraph: JSONContent): string {
  const textNodes = (paragraph.content ?? []).filter((node) => node.type === "text");

  let output = "";
  let openMarks: MarkName[] = [];

  for (const node of textNodes) {
    const targetMarks = orderedMarksOf(node);

    let commonLength = 0;
    while (
      commonLength < openMarks.length &&
      commonLength < targetMarks.length &&
      openMarks[commonLength] === targetMarks[commonLength]
    ) {
      commonLength++;
    }

    for (let i = openMarks.length - 1; i >= commonLength; i--) {
      output += CANONICAL_DELIMITER[openMarks[i]];
    }
    for (let i = commonLength; i < targetMarks.length; i++) {
      output += CANONICAL_DELIMITER[targetMarks[i]];
    }

    output += node.text ?? "";
    openMarks = targetMarks;
  }

  for (let i = openMarks.length - 1; i >= 0; i--) {
    output += CANONICAL_DELIMITER[openMarks[i]];
  }

  return output;
}

function serializeParagraph(paragraph: JSONContent): string {
  const markerId = (paragraph.attrs?.markerId as string | null) ?? "";
  const align =
    (paragraph.attrs?.textAlign as string | undefined) ?? DEFAULT_ALIGNMENT;
  const headingLevel =
    (paragraph.attrs?.headingLevel as HeadingLevel | undefined) ??
    DEFAULT_HEADING_LEVEL;
  const comment = (paragraph.attrs?.comment as string | null) ?? null;
  const headingPrefix =
    headingLevel > 0 ? `${"#".repeat(headingLevel)} ` : "";
  const commentAttr = comment
    ? ` ${MARKER_COMMENT_ATTR}="${escapeMarkerComment(comment)}"`
    : "";
  const inline = serializeParagraphInline(paragraph);
  const wrapped = `${headingPrefix}${MARKER_OPEN}${markerId}${commentAttr}${MARKER_CLOSE}${inline}${MARKER_OPEN}${MARKER_CLOSE_SLASH}${markerId}${MARKER_CLOSE}`;

  if (align !== DEFAULT_ALIGNMENT) {
    return `${ALIGN_BLOCK_OPEN} ${align}\n${wrapped}\n${ALIGN_BLOCK_CLOSE}`;
  }
  return wrapped;
}

/** 把 Tiptap 的 doc JSON 序列化成白名單規則下的自訂 markdown 字串。 */
export function serializeDocToMarkdown(doc: JSONContent): string {
  return (doc.content ?? [])
    .filter((node) => node.type === "paragraph")
    .map(serializeParagraph)
    .join("\n\n");
}
