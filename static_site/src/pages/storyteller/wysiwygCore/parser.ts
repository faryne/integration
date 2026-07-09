import type { JSONContent } from "@tiptap/core";

import {
  ALIGNMENT_VALUES,
  BG_COLOR_VALUES,
  COMMENT_COLOR_VALUES,
  DEFAULT_ALIGNMENT,
  DEFAULT_COMMENT_COLOR,
  DEFAULT_HEADING_LEVEL,
  FOOTNOTE_PARSE_DELIMITERS,
  INLINE_MARKER_TYPES,
  isSafeHref,
  LINK_TARGET_VALUES,
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
  PARSE_DELIMITERS,
  TEXT_COLOR_VALUES,
  unescapeMarkerComment,
  type AlignmentValue,
  type BgColorValue,
  type CommentColorValue,
  type HeadingLevel,
  type LinkTargetValue,
  type MarkName,
  type TextColorValue,
} from "./whitelist";

export interface ParsedRun {
  text: string;
  marks: MarkName[];
  /** 文字前景色（span 行內 marker），沒設定就是 undefined。 */
  textColor?: TextColorValue;
  /** 文字背景色（span 行內 marker），沒設定就是 undefined。 */
  bgColor?: BgColorValue;
  /** 連結網址（a 行內 marker），已經過 scheme 安全檢查，沒設定就是 undefined。 */
  href?: string;
  /** 連結開啟方式，目前只有 "_blank" 有意義，沒設定就是同分頁開啟。 */
  target?: LinkTargetValue;
  /**
   * 腳注的 marker id（含 `footnote-` 前綴），同一個腳注橫跨多個 run（例如錨定文字裡有
   * 粗體）時，這些 run 的 footnoteId 會是同一個值——渲染端要靠這個判斷「連續幾個 run
   * 其實是同一個腳注錨點」，只在整組結束後渲染一次上標編號，不是每個 run 各渲染一次。
   */
  footnoteId?: string;
  /** 腳注內文（原始字串，可能還帶著粗體/斜體/底線的 delimiter，尚未解析），沒設定就是 undefined。 */
  footnoteNote?: string;
}

export interface ParsedParagraph {
  markerId: string | null;
  align: AlignmentValue;
  headingLevel: HeadingLevel;
  comment: string | null;
  commentColor: CommentColorValue | null;
  runs: ParsedRun[];
}

/** 比照 CommonMark ATX heading：行首 1~6 個 #，後面不能緊接第 7 個 #，再接一個空白。 */
const HEADING_PATTERN = /^(#{1,6})(?!#) ([\s\S]*)$/;

// group 1: markerId／group 2: align（可能不存在，省略代表置左）／group 3: comment（跳脫過，可能不存在）
// group 4: commentColor（可能不存在，省略代表預設色）／group 5: 段落內容／group 6: 結尾的 markerId
// 三個屬性順序固定是 align、comment、commentColor，序列化時也要照這個順序輸出。
// comment 屬性值用「(?:[^"\\]|\\.)*」掃描：逐字比對「不是引號也不是反斜線的字元」或「反斜線+任一字元（跳脫序列）」，
// 這樣才能正確找到「沒被跳脫的那個引號」當結尾，而不是天真地找下一個 " 就當結束。
const MARKER_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}\\s]*)` +
    `(?: ${MARKER_ALIGN_ATTR}="(${ALIGNMENT_VALUES.join("|")})")?` +
    `(?: ${MARKER_COMMENT_ATTR}="((?:[^"\\\\]|\\\\.)*)")?` +
    `(?: ${MARKER_COMMENT_COLOR_ATTR}="(${COMMENT_COLOR_VALUES.join("|")})")?` +
    `${MARKER_CLOSE}([\\s\\S]*)${MARKER_OPEN}${MARKER_CLOSE_SLASH}([^${MARKER_CLOSE}\\s]*)${MARKER_CLOSE}$`,
);

// 行內 marker 目前支援的屬性總集合（span 的顏色、a 的連結、footnote 的內文）。同一個
// marker 實例只會用到其中跟自己 type 相關的欄位，其餘保持 undefined——不用照 type
// 分流解析，因為屬性名稱本身就不會撞名，直接掃出所有認得的屬性即可，parseInline
// 不需要知道 marker 是哪個 type。
interface InlineAttrs {
  textColor?: TextColorValue;
  bgColor?: BgColorValue;
  href?: string;
  target?: LinkTargetValue;
  note?: string;
}

// 行內 marker 的開頭標記（sticky，用 lastIndex 從指定位置比對）：
// group 1 = 完整 id token（例如 span-a3f9／a-b7c1）／group 2 = 屬性字串（可能為空，前面帶空白）。
// 屬性值的掃描規則跟段落 marker 的 comment 一樣（跳脫感知）——href 是自由格式值，
// 必須用這套逐字跳脫規則，不能像顏色那樣假設值裡不會出現引號。
const INLINE_MARKER_OPEN = new RegExp(
  `${MARKER_OPEN}((?:${INLINE_MARKER_TYPES.join("|")})-[^${MARKER_CLOSE}\\s]+)` +
    `((?: [A-Za-z]+="(?:[^"\\\\]|\\\\.)*")*)` +
    `${MARKER_CLOSE}`,
  "y",
);

/** 從屬性字串（例如 ` textColor="red"` 或 ` href="https://..." target="_blank"`）抽出認得、且值合法的屬性。 */
function parseInlineAttrs(attrBlob: string): InlineAttrs {
  const result: InlineAttrs = {};
  const attrRe = /([A-Za-z]+)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(attrBlob)) !== null) {
    const name = match[1];
    const value = unescapeMarkerComment(match[2]);
    if (
      name === MARKER_TEXT_COLOR_ATTR &&
      (TEXT_COLOR_VALUES as readonly string[]).includes(value)
    ) {
      result.textColor = value as TextColorValue;
    } else if (
      name === MARKER_BG_COLOR_ATTR &&
      (BG_COLOR_VALUES as readonly string[]).includes(value)
    ) {
      result.bgColor = value as BgColorValue;
    } else if (name === MARKER_HREF_ATTR && isSafeHref(value)) {
      // 防禦性檢查：就算 DB 裡不知怎麼混進了危險 scheme（例如手動改資料、之後的匯入功能），
      // 解析階段也不會把它當成有效連結，不能只靠編輯器輸入時的驗證。
      result.href = value;
    } else if (
      name === MARKER_TARGET_ATTR &&
      (LINK_TARGET_VALUES as readonly string[]).includes(value)
    ) {
      result.target = value as LinkTargetValue;
    } else if (name === MARKER_NOTE_ATTR) {
      // note 沒有固定色盤那種值限制（自由格式文字），跟 comment 屬性一樣直接接受，
      // 只要跳脫格式正確就算合法。
      result.note = value;
    }
  }
  return result;
}

/**
 * 把行內 marker 的屬性套到 run 上：巢狀時內層優先（內層已經有值就不被外層覆蓋）。
 * `markerId` 是這個行內 marker 的完整 id（含 type 前綴，例如 `footnote-a3f9`）——
 * 只有 footnote 需要記住是「哪一個」腳注（用來判斷連續 run 是不是同一個腳注錨點、
 * 渲染端也要靠這個 id 產生錨點/回連結的 DOM id），span/a 不需要，其他屬性
 * （顏色/連結）只看值本身就夠了，不需要記 id。
 */
function applyInlineAttrs(
  run: ParsedRun,
  attrs: InlineAttrs,
  markerId: string,
): ParsedRun {
  const isFootnote = markerId.startsWith("footnote-");
  return {
    ...run,
    textColor: run.textColor ?? attrs.textColor,
    bgColor: run.bgColor ?? attrs.bgColor,
    href: run.href ?? attrs.href,
    target: run.target ?? attrs.target,
    footnoteId: run.footnoteId ?? (isFootnote ? markerId : undefined),
    footnoteNote: run.footnoteNote ?? (isFootnote ? attrs.note : undefined),
  };
}

type NextToken =
  | {
      index: number;
      kind: "delimiter";
      delimiter: (typeof PARSE_DELIMITERS)[number];
    }
  | {
      index: number;
      kind: "marker";
      id: string;
      attrs: InlineAttrs;
      openEnd: number;
    };

/** 從左到右找出下一個「特殊記號」——行內 marker 開頭或行內樣式 delimiter，先出現的優先。 */
function findNextToken(text: string): NextToken | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === MARKER_OPEN) {
      INLINE_MARKER_OPEN.lastIndex = i;
      const match = INLINE_MARKER_OPEN.exec(text);
      if (match && match.index === i) {
        return {
          index: i,
          kind: "marker",
          id: match[1],
          attrs: parseInlineAttrs(match[2]),
          openEnd: i + match[0].length,
        };
      }
      // 是個孤兒 ⟦（例如 ⟦/xxx⟧ 或不成形的標記）：當純文字，繼續往後掃。
      continue;
    }
    for (const candidate of PARSE_DELIMITERS) {
      if (text.startsWith(candidate.delimiter, i)) {
        return { index: i, kind: "delimiter", delimiter: candidate };
      }
    }
  }
  return null;
}

/**
 * 非白名單語法（標題、清單、表格、程式碼區塊等）一律不會被比對到，會原封不動落在
 * plain text run 裡，滿足「略過解析、以純文字顯示」的規則。行內樣式（粗體等 delimiter）
 * 跟行內 marker（span 顏色）在這裡一起處理，兩者都可以互相巢狀（顏色包粗體、粗體包顏色）。
 */
function parseInline(text: string): ParsedRun[] {
  if (text === "") return [];

  const token = findNextToken(text);
  if (!token) return [{ text, marks: [] }];

  const before = text.slice(0, token.index);
  const beforeRuns: ParsedRun[] = before ? [{ text: before, marks: [] }] : [];

  if (token.kind === "delimiter") {
    const delimiter = token.delimiter.delimiter;
    const searchFrom = token.index + delimiter.length;
    const closeIndex = text.indexOf(delimiter, searchFrom);
    if (closeIndex === -1) {
      // 找不到對應的結尾記號：把這個記號（連同前面的純文字）當純文字，繼續往後掃描。
      return [
        { text: text.slice(0, searchFrom), marks: [] },
        ...parseInline(text.slice(searchFrom)),
      ];
    }
    const innerRaw = text.slice(searchFrom, closeIndex);
    const after = text.slice(closeIndex + delimiter.length);
    const innerRuns = parseInline(innerRaw).map((run) => ({
      ...run,
      marks: [...run.marks, token.delimiter.markName],
    }));
    return [...beforeRuns, ...innerRuns, ...parseInline(after)];
  }

  // token.kind === "marker"：找對應 id 的結束標記 ⟦/<id>⟧。
  const closeTag = `${MARKER_OPEN}${MARKER_CLOSE_SLASH}${token.id}${MARKER_CLOSE}`;
  const closeIndex = text.indexOf(closeTag, token.openEnd);
  if (closeIndex === -1) {
    // 找不到結束標記：開頭標記整段當純文字，繼續往後掃描。
    return [
      { text: text.slice(0, token.openEnd), marks: [] },
      ...parseInline(text.slice(token.openEnd)),
    ];
  }
  const innerRaw = text.slice(token.openEnd, closeIndex);
  const after = text.slice(closeIndex + closeTag.length);
  const innerRuns = parseInline(innerRaw).map((run) =>
    applyInlineAttrs(run, token.attrs, token.id),
  );
  return [...beforeRuns, ...innerRuns, ...parseInline(after)];
}

/** 兩個 run 的「格式」是否完全相同（marks 序列＋顏色＋連結＋腳注），normalizeRuns 用來決定能不能合併。 */
function sameFormatting(a: ParsedRun, b: ParsedRun): boolean {
  return (
    a.marks.length === b.marks.length &&
    a.marks.every((mark, i) => mark === b.marks[i]) &&
    a.textColor === b.textColor &&
    a.bgColor === b.bgColor &&
    a.href === b.href &&
    a.target === b.target &&
    a.footnoteId === b.footnoteId
  );
}

function normalizeRuns(runs: ParsedRun[]): ParsedRun[] {
  const merged: ParsedRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && sameFormatting(last, run)) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/**
 * 腳注內文的簡化版行內解析：只認粗體/斜體/底線（`FOOTNOTE_PARSE_DELIMITERS`，見
 * whitelist.ts 為什麼刻意不含上下標），不認行內 marker（腳注內文不能再巢狀另一個
 * 顏色/連結/腳注——這是屬性值裡的一段純文字，不是段落 runs 的一部分）。
 * 給渲染端（閱讀頁的腳注清單、編輯區的 hover tooltip）共用，兩邊都要看到一樣的格式。
 */
export function parseFootnoteNoteRuns(note: string): ParsedRun[] {
  function parse(text: string): ParsedRun[] {
    if (text === "") return [];

    let openIndex = -1;
    let openDelimiter: (typeof FOOTNOTE_PARSE_DELIMITERS)[number] | null = null;
    outer: for (let i = 0; i < text.length; i++) {
      for (const candidate of FOOTNOTE_PARSE_DELIMITERS) {
        if (text.startsWith(candidate.delimiter, i)) {
          openIndex = i;
          openDelimiter = candidate;
          break outer;
        }
      }
    }
    if (openIndex === -1 || !openDelimiter) return [{ text, marks: [] }];

    const searchFrom = openIndex + openDelimiter.delimiter.length;
    const closeIndex = text.indexOf(openDelimiter.delimiter, searchFrom);
    if (closeIndex === -1) {
      return [
        { text: text.slice(0, searchFrom), marks: [] },
        ...parse(text.slice(searchFrom)),
      ];
    }

    const before = text.slice(0, openIndex);
    const innerRaw = text.slice(searchFrom, closeIndex);
    const after = text.slice(closeIndex + openDelimiter.delimiter.length);
    const innerRuns = parse(innerRaw).map((run) => ({
      ...run,
      marks: [...run.marks, openDelimiter!.markName],
    }));
    const beforeRuns: ParsedRun[] = before ? [{ text: before, marks: [] }] : [];
    return [...beforeRuns, ...innerRuns, ...parse(after)];
  }

  return normalizeRuns(parse(note));
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
  commentColor: CommentColorValue | null;
  content: string;
} {
  const match = line.match(MARKER_PATTERN);
  if (match && match[1] === match[6]) {
    const align = (match[2] as AlignmentValue | undefined) ?? DEFAULT_ALIGNMENT;
    const comment =
      match[3] !== undefined ? unescapeMarkerComment(match[3]) : null;
    // commentColor 只有在有 comment 時才有意義；省略時（含舊資料）沿用預設色。
    const commentColor = comment
      ? ((match[4] as CommentColorValue | undefined) ?? DEFAULT_COMMENT_COLOR)
      : null;
    return {
      markerId: match[1],
      align,
      comment,
      commentColor,
      content: match[5],
    };
  }
  // 舊資料尚未跑過 marker 遷移，或內容不是本編輯器產生的：整行當純文字，id 留空由呼叫端決定怎麼補。
  return {
    markerId: null,
    align: DEFAULT_ALIGNMENT,
    comment: null,
    commentColor: null,
    content: line,
  };
}

/** 一行＝一個段落，見 whitelist.ts 的 MARKER_OPEN 說明：要跟書籤/diff 既有的逐行索引保持一致。 */
function parseLine(line: string): ParsedParagraph {
  const { headingLevel, content: afterHeading } = extractHeading(line);
  const { markerId, align, comment, commentColor, content } =
    extractMarker(afterHeading);
  const runs = normalizeRuns(parseInline(content));

  return { markerId, align, headingLevel, comment, commentColor, runs };
}

// 行內 marker 的開頭／結束標記，供「diff 前清乾淨」用。這裡是不管配對、單純把記號本身
// 抽掉（保留被包住的文字），因為 diff 只需要看得到的文字、不需要語意正確的巢狀結構。
const INLINE_MARKER_STRIP_PATTERN = new RegExp(
  `${MARKER_OPEN}${MARKER_CLOSE_SLASH}?(?:${INLINE_MARKER_TYPES.join("|")})-[^${MARKER_CLOSE}\\s]+` +
    `(?: [A-Za-z]+="(?:[^"\\\\]|\\\\.)*")*${MARKER_CLOSE}`,
  "g",
);

/** 把一段內容裡的行內 marker 記號（span 顏色等）抽掉，只留下被包住的文字。 */
export function stripInlineMarkers(content: string): string {
  return content.replace(INLINE_MARKER_STRIP_PATTERN, "");
}

/**
 * 拿掉一行裡的段落 marker（含 align／comment 屬性）＋行內 marker（span 顏色等），保留標題前綴
 * 跟行內樣式 delimiter（`**` 等）不變。給「逐行文字 diff」這種不會透過我們的解析器渲染、
 * 只是把字串原樣顯示出來的地方用——不濾掉的話，marker id 換了、或單純加/改/刪一則註解／
 * 調整對齊／改個顏色，都會被 diff 誤判成「內容變了」，使用者也會在畫面上直接看到
 * `⟦uuid⟧...⟦/uuid⟧`、`⟦span-x⟧...⟦/span-x⟧` 這種不該曝光的內部語法。
 */
export function stripMarkerForDiffLine(line: string): string {
  const { headingLevel, content: afterHeading } = extractHeading(line);
  const { content } = extractMarker(afterHeading);

  const headingPrefix = headingLevel > 0 ? `${"#".repeat(headingLevel)} ` : "";
  return `${headingPrefix}${stripInlineMarkers(content)}`;
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

/**
 * 依文件順序收集這份內容裡所有腳注的「乾淨內文」（粗體/斜體/底線的 delimiter 已經拿掉，
 * 只留讀者看得到的文字），供版本 diff 頁單獨比對用——閱讀頁把腳注放在故事尾端渲染，
 * diff 也比照辦理，把腳注跟本文分開兩個區塊比對，不是把腳注文字塞進本文那一行裡。
 * 一個腳注可能橫跨多個 run（錨定文字裡有粗體），但只在第一次遇到某個 footnoteId 時
 * 收集一次，避免同一則腳注被重複列出。
 */
export function extractFootnoteNotesForDiff(content: string): string[] {
  const paragraphs = parseMarkdownToParagraphs(content);
  const seenFootnoteIds = new Set<string>();
  const notes: string[] = [];
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (!run.footnoteId || seenFootnoteIds.has(run.footnoteId)) continue;
      seenFootnoteIds.add(run.footnoteId);
      notes.push(
        parseFootnoteNoteRuns(run.footnoteNote ?? "")
          .map((noteRun) => noteRun.text)
          .join(""),
      );
    }
  }
  return notes;
}

/**
 * 把一個 run 轉成 Tiptap 的 mark 陣列：純開關 marks（粗體等）＋帶值的顏色／連結／腳注 marks。
 * 腳注 mark 故意不帶 id——id 只是序列化時產生的配對用途（見 whitelist.ts 的
 * generateInlineMarkerId 說明），跟 span/a 一樣不需要存進 Tiptap 文件本身的狀態。
 */
function runToTiptapMarks(
  run: ParsedRun,
): { type: string; attrs?: Record<string, string> }[] {
  const marks: { type: string; attrs?: Record<string, string> }[] =
    run.marks.map((mark) => ({ type: mark }));
  if (run.textColor) {
    marks.push({ type: "textColor", attrs: { value: run.textColor } });
  }
  if (run.bgColor) {
    marks.push({ type: "bgColor", attrs: { value: run.bgColor } });
  }
  if (run.href) {
    marks.push({
      type: "link",
      attrs: { href: run.href, target: run.target ?? "" },
    });
  }
  if (run.footnoteId) {
    marks.push({ type: "footnote", attrs: { note: run.footnoteNote ?? "" } });
  }
  return marks;
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
        commentColor: paragraph.commentColor,
      },
      content: paragraph.runs
        .filter((run) => run.text !== "")
        .map((run) => {
          const marks = runToTiptapMarks(run);
          return {
            type: "text",
            text: run.text,
            ...(marks.length > 0 ? { marks } : {}),
          };
        }),
    })),
  };
}

export function markdownToDoc(markdown: string): JSONContent {
  return paragraphsToDoc(parseMarkdownToParagraphs(markdown));
}
