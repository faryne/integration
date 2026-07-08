import type { JSONContent } from "@tiptap/core";

import {
  ALIGNMENT_VALUES,
  DEFAULT_ALIGNMENT,
  DEFAULT_HEADING_LEVEL,
  MARKER_ALIGN_ATTR,
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

/** 比照 CommonMark ATX heading：行首 1~6 個 #，後面不能緊接第 7 個 #，再接一個空白。 */
const HEADING_PATTERN = /^(#{1,6})(?!#) ([\s\S]*)$/;

// group 1: markerId／group 2: align（可能不存在，省略代表置左）／group 3: comment（跳脫過，可能不存在）
// group 4: 段落內容／group 5: 結尾的 markerId
// 兩個屬性順序固定是 align 在前、comment 在後，序列化時也要照這個順序輸出。
// comment 屬性值用「(?:[^"\\]|\\.)*」掃描：逐字比對「不是引號也不是反斜線的字元」或「反斜線+任一字元（跳脫序列）」，
// 這樣才能正確找到「沒被跳脫的那個引號」當結尾，而不是天真地找下一個 " 就當結束。
const MARKER_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}\\s]*)` +
    `(?: ${MARKER_ALIGN_ATTR}="(${ALIGNMENT_VALUES.join("|")})")?` +
    `(?: ${MARKER_COMMENT_ATTR}="((?:[^"\\\\]|\\\\.)*)")?` +
    `${MARKER_CLOSE}([\\s\\S]*)${MARKER_OPEN}${MARKER_CLOSE_SLASH}([^${MARKER_CLOSE}\\s]*)${MARKER_CLOSE}$`,
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

function extractHeading(line: string): {
  headingLevel: HeadingLevel;
  content: string;
} {
  const match = line.match(HEADING_PATTERN);
  if (match) {
    return { headingLevel: match[1].length as HeadingLevel, content: match[2] };
  }
  return { headingLevel: DEFAULT_HEADING_LEVEL, content: line };
}

function extractMarker(line: string): {
  markerId: string | null;
  align: AlignmentValue;
  comment: string | null;
  content: string;
} {
  const match = line.match(MARKER_PATTERN);
  if (match && match[1] === match[5]) {
    const align = (match[2] as AlignmentValue | undefined) ?? DEFAULT_ALIGNMENT;
    const comment = match[3] !== undefined ? unescapeMarkerComment(match[3]) : null;
    return { markerId: match[1], align, comment, content: match[4] };
  }
  // 舊資料尚未跑過 marker 遷移，或內容不是本編輯器產生的：整行當純文字，id 留空由呼叫端決定怎麼補。
  return { markerId: null, align: DEFAULT_ALIGNMENT, comment: null, content: line };
}

/** 一行＝一個段落，見 whitelist.ts 的 MARKER_OPEN 說明：要跟書籤/diff 既有的逐行索引保持一致。 */
function parseLine(line: string): ParsedParagraph {
  const { headingLevel, content: afterHeading } = extractHeading(line);
  const { markerId, align, comment, content } = extractMarker(afterHeading);
  const runs = normalizeRuns(parseInline(content));

  return { markerId, align, headingLevel, comment, runs };
}

/**
 * 拿掉一行裡的 marker 開始/結束標記（含 align／comment 屬性），保留標題前綴跟行內樣式語法不變。
 * 給「逐行文字 diff」這種不會透過我們的解析器渲染、只是把字串原樣顯示出來的地方用——
 * 不濾掉的話，marker id 換了、或單純加/改/刪一則註解／調整對齊，都會被 diff 誤判成「內容變了」，
 * 使用者也會在畫面上直接看到 `⟦uuid⟧...⟦/uuid⟧` 這種不該曝光的內部語法。
 */
export function stripMarkerForDiffLine(line: string): string {
  const { headingLevel, content: afterHeading } = extractHeading(line);
  const { content } = extractMarker(afterHeading);

  const headingPrefix = headingLevel > 0 ? `${"#".repeat(headingLevel)} ` : "";
  return `${headingPrefix}${content}`;
}

/** stripMarkerForDiffLine 套用在整份內容上，逐行處理後用 \n 接回去，方便直接餵給 buildCustomLineDiff。 */
export function stripMarkerForDiffContent(content: string): string {
  return content.split("\n").map(stripMarkerForDiffLine).join("\n");
}

/**
 * 把白名單規則下的自訂 markdown 字串解析成段落陣列，供載入編輯器或預覽渲染共用。
 * 刻意用原始字串直接 split("\n")，不 trim、不特別處理空字串——要跟
 * `content.split("\n")`（書籤 line_index、版本 diff 用的陣列）逐一對應。
 */
export function parseMarkdownToParagraphs(markdown: string): ParsedParagraph[] {
  return markdown.split("\n").map(parseLine);
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
