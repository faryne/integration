import type { JSONContent } from "@tiptap/core";

import {
  ALIGNMENT_VALUES,
  ALIGN_BLOCK_CLOSE,
  ALIGN_BLOCK_OPEN,
  DEFAULT_ALIGNMENT,
  MARKER_CLOSE,
  MARKER_CLOSE_SLASH,
  MARKER_OPEN,
  PARSE_DELIMITERS,
  type AlignmentValue,
  type MarkName,
} from "./whitelist";

export interface ParsedRun {
  text: string;
  marks: MarkName[];
}

export interface ParsedParagraph {
  markerId: string | null;
  align: AlignmentValue;
  runs: ParsedRun[];
}

const ALIGN_BLOCK_PATTERN = new RegExp(
  `^${ALIGN_BLOCK_OPEN} (${ALIGNMENT_VALUES.join("|")})\\n([\\s\\S]*)\\n${ALIGN_BLOCK_CLOSE}$`,
);

const MARKER_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}]*)${MARKER_CLOSE}([\\s\\S]*)${MARKER_OPEN}${MARKER_CLOSE_SLASH}([^${MARKER_CLOSE}]*)${MARKER_CLOSE}$`,
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

function extractMarker(innerLine: string): {
  markerId: string | null;
  content: string;
} {
  const match = innerLine.match(MARKER_PATTERN);
  if (match && match[1] === match[3]) {
    return { markerId: match[1], content: match[2] };
  }
  // 舊資料尚未跑過 marker 遷移，或內容不是本編輯器產生的：整段當純文字，id 留空由呼叫端決定怎麼補。
  return { markerId: null, content: innerLine };
}

function parseBlock(block: string): ParsedParagraph {
  const alignMatch = block.match(ALIGN_BLOCK_PATTERN);
  const align: AlignmentValue = alignMatch
    ? (alignMatch[1] as AlignmentValue)
    : DEFAULT_ALIGNMENT;
  const innerLine = alignMatch ? alignMatch[2] : block;

  const { markerId, content } = extractMarker(innerLine);
  const runs = normalizeRuns(parseInline(content));

  return { markerId, align, runs };
}

/** 把白名單規則下的自訂 markdown 字串解析成段落陣列，供載入編輯器或預覽渲染共用。 */
export function parseMarkdownToParagraphs(markdown: string): ParsedParagraph[] {
  const trimmed = markdown.trim();
  if (trimmed === "") return [{ markerId: null, align: DEFAULT_ALIGNMENT, runs: [] }];

  return trimmed.split(/\n\s*\n/).map(parseBlock);
}

/** 把段落陣列組成 Tiptap 可以直接 setContent 的 doc JSON。 */
export function paragraphsToDoc(paragraphs: ParsedParagraph[]): JSONContent {
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      attrs: { markerId: paragraph.markerId, textAlign: paragraph.align },
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
