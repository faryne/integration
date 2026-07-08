import type { JSONContent } from "@tiptap/core";

import {
  ALIGNMENT_VALUES,
  ALIGN_BLOCK_CLOSE,
  ALIGN_BLOCK_OPEN,
  DEFAULT_ALIGNMENT,
  DEFAULT_HEADING_LEVEL,
  MARKER_CLOSE,
  MARKER_CLOSE_SLASH,
  MARKER_COMMENT_ATTR,
  MARKER_OPEN,
  PARSE_DELIMITERS,
  unescapeMarkerComment,
  type AlignmentValue,
  type HeadingLevel,
  type MarkName,
} from "./whitelist";

export interface ParsedRun {
  text: string;
  marks: MarkName[];
}

export interface ParsedParagraph {
  markerId: string | null;
  align: AlignmentValue;
  headingLevel: HeadingLevel;
  comment: string | null;
  runs: ParsedRun[];
}

const ALIGN_BLOCK_PATTERN = new RegExp(
  `^${ALIGN_BLOCK_OPEN} (${ALIGNMENT_VALUES.join("|")})\\n([\\s\\S]*)\\n${ALIGN_BLOCK_CLOSE}$`,
);

/** 比照 CommonMark ATX heading：行首 1~6 個 #，後面不能緊接第 7 個 #，再接一個空白。 */
const HEADING_PATTERN = /^(#{1,6})(?!#) ([\s\S]*)$/;

// group 1: markerId／group 2: comment（跳脫過，可能不存在）／group 3: 段落內容／group 4: 結尾的 markerId
// comment 屬性值用「(?:[^"\\]|\\.)*」掃描：逐字比對「不是引號也不是反斜線的字元」或「反斜線+任一字元（跳脫序列）」，
// 這樣才能正確找到「沒被跳脫的那個引號」當結尾，而不是天真地找下一個 " 就當結束。
const MARKER_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}\\s]*)(?: ${MARKER_COMMENT_ATTR}="((?:[^"\\\\]|\\\\.)*)")?${MARKER_CLOSE}([\\s\\S]*)${MARKER_OPEN}${MARKER_CLOSE_SLASH}([^${MARKER_CLOSE}\\s]*)${MARKER_CLOSE}$`,
);

/**
 * 非白名單語法（標題、清單、連結、表格、程式碼區塊等）一律不會被以上規則比對到，
 * 因此會原封不動地落在 plain text run 裡，滿足「略過解析、以純文字顯示」的規則。
 */
function parseInline(text: string): ParsedRun[] {
  if (text === "") return [];

  let openIndex = -1;
  let openDelimiter: (typeof PARSE_DELIMITERS)[number] | null = null;

  outer: for (let i = 0; i < text.length; i++) {
    for (const candidate of PARSE_DELIMITERS) {
      if (text.startsWith(candidate.delimiter, i)) {
        openIndex = i;
        openDelimiter = candidate;
        break outer;
      }
    }
  }

  if (openIndex === -1 || !openDelimiter) {
    return [{ text, marks: [] }];
  }

  const searchFrom = openIndex + openDelimiter.delimiter.length;
  const closeIndex = text.indexOf(openDelimiter.delimiter, searchFrom);

  if (closeIndex === -1) {
    // 找不到對應的結尾記號：把這個記號當成純文字，繼續往後掃描
    const literalPrefix = text.slice(0, searchFrom);
    return [{ text: literalPrefix, marks: [] }, ...parseInline(text.slice(searchFrom))];
  }

  const before = text.slice(0, openIndex);
  const innerRaw = text.slice(searchFrom, closeIndex);
  const after = text.slice(closeIndex + openDelimiter.delimiter.length);

  const innerRuns = parseInline(innerRaw).map((run) => ({
    text: run.text,
    marks: [...run.marks, openDelimiter!.markName],
  }));

  const beforeRuns: ParsedRun[] = before ? [{ text: before, marks: [] }] : [];
  return [...beforeRuns, ...innerRuns, ...parseInline(after)];
}

function sameMarks(a: MarkName[], b: MarkName[]): boolean {
  return a.length === b.length && a.every((mark, i) => mark === b[i]);
}

function normalizeRuns(runs: ParsedRun[]): ParsedRun[] {
  const merged: ParsedRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last.marks, run.marks)) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function extractHeading(innerLine: string): {
  headingLevel: HeadingLevel;
  content: string;
} {
  const match = innerLine.match(HEADING_PATTERN);
  if (match) {
    return { headingLevel: match[1].length as HeadingLevel, content: match[2] };
  }
  return { headingLevel: DEFAULT_HEADING_LEVEL, content: innerLine };
}

function extractMarker(innerLine: string): {
  markerId: string | null;
  comment: string | null;
  content: string;
} {
  const match = innerLine.match(MARKER_PATTERN);
  if (match && match[1] === match[4]) {
    const comment = match[2] !== undefined ? unescapeMarkerComment(match[2]) : null;
    return { markerId: match[1], comment, content: match[3] };
  }
  // 舊資料尚未跑過 marker 遷移，或內容不是本編輯器產生的：整段當純文字，id 留空由呼叫端決定怎麼補。
  return { markerId: null, comment: null, content: innerLine };
}

function parseBlock(block: string): ParsedParagraph {
  const alignMatch = block.match(ALIGN_BLOCK_PATTERN);
  const align: AlignmentValue = alignMatch
    ? (alignMatch[1] as AlignmentValue)
    : DEFAULT_ALIGNMENT;
  const afterAlign = alignMatch ? alignMatch[2] : block;

  const { headingLevel, content: afterHeading } = extractHeading(afterAlign);
  const { markerId, comment, content } = extractMarker(afterHeading);
  const runs = normalizeRuns(parseInline(content));

  return { markerId, align, headingLevel, comment, runs };
}

/** 把白名單規則下的自訂 markdown 字串解析成段落陣列，供載入編輯器或預覽渲染共用。 */
export function parseMarkdownToParagraphs(markdown: string): ParsedParagraph[] {
  const trimmed = markdown.trim();
  if (trimmed === "")
    return [
      {
        markerId: null,
        align: DEFAULT_ALIGNMENT,
        headingLevel: DEFAULT_HEADING_LEVEL,
        comment: null,
        runs: [],
      },
    ];

  return trimmed.split(/\n\s*\n/).map(parseBlock);
}

/** 把段落陣列組成 Tiptap 可以直接 setContent 的 doc JSON。 */
export function paragraphsToDoc(paragraphs: ParsedParagraph[]): JSONContent {
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      attrs: {
        markerId: paragraph.markerId,
        textAlign: paragraph.align,
        headingLevel: paragraph.headingLevel,
        comment: paragraph.comment,
      },
      content: paragraph.runs
        .filter((run) => run.text !== "")
        .map((run) => ({
          type: "text",
          text: run.text,
          ...(run.marks.length > 0
            ? { marks: run.marks.map((mark) => ({ type: mark })) }
            : {}),
        })),
    })),
  };
}

export function markdownToDoc(markdown: string): JSONContent {
  return paragraphsToDoc(parseMarkdownToParagraphs(markdown));
}
