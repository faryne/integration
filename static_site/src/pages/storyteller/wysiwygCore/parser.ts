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
  /**
   * 註解的 marker id（含 `comment-` 前綴）。2026-07-09 起註解改成行內 marker（原本是段落
   * marker 的屬性），道理跟 footnoteId 一樣：同一則註解橫跨多個 run 時共用同一個值，
   * 編輯區的 hover/右鍵編輯要靠這個判斷「這段範圍屬於同一則註解」。
   */
  commentId?: string;
  /** 註解文字，沒設定就是 undefined。註解只在編輯區顯示，不會出現在讀者端渲染或字數統計。 */
  comment?: string;
  /** 註解底色，沒設定時渲染端要 fallback 成 DEFAULT_COMMENT_COLOR（比照原本段落屬性的規則）。 */
  commentColor?: CommentColorValue;
}

export interface ParsedParagraph {
  markerId: string | null;
  align: AlignmentValue;
  headingLevel: HeadingLevel;
  runs: ParsedRun[];
}

/** 比照 CommonMark ATX heading：行首 1~6 個 #，後面不能緊接第 7 個 #，再接一個空白。 */
const HEADING_PATTERN = /^(#{1,6})(?!#) ([\s\S]*)$/;

// group 1: markerId／group 2: align（可能不存在，省略代表置左）／group 3: 段落內容／group 4: 結尾的 markerId
// 註解已經改成行內 marker（見下面 InlineAttrs），不再是段落 marker 的屬性。
const MARKER_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}\\s]*)` +
    `(?: ${MARKER_ALIGN_ATTR}="(${ALIGNMENT_VALUES.join("|")})")?` +
    `${MARKER_CLOSE}([\\s\\S]*)${MARKER_OPEN}${MARKER_CLOSE_SLASH}([^${MARKER_CLOSE}\\s]*)${MARKER_CLOSE}$`,
);

// 舊資料相容：2026-07-09 之前，註解是段落 marker 的屬性（align 之後、緊接著 commentColor）。
// 上面的 MARKER_PATTERN 不會比對這兩個屬性了（新資料不會再寫入），舊格式的段落會直接整個
// 比對失敗、退化成整行當純文字——這樣使用者既有的註解會憑空消失、還會在畫面上看到原始
// `⟦...⟧` 語法。這裡另外用一個「一定要有 comment 屬性」的寬鬆版 pattern 偵測舊格式，
// group 1=markerId／2=align／3=comment（必要，跳脫過）／4=commentColor／5=段落內容／
// 6=結尾 markerId。偵測到就在 extractMarker 裡把整段內容包一層合成的行內 comment marker，
// 沿用 parseInline 既有的行內 marker解析路徑——不用另外寫一次性遷移腳本，下次存檔
// 就會自然序列化成新格式（原地遷移）。
const LEGACY_PARAGRAPH_COMMENT_PATTERN = new RegExp(
  `^${MARKER_OPEN}([^${MARKER_CLOSE}\\s]*)` +
    `(?: ${MARKER_ALIGN_ATTR}="(${ALIGNMENT_VALUES.join("|")})")?` +
    `(?: ${MARKER_COMMENT_ATTR}="((?:[^"\\\\]|\\\\.)*)")` +
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
  comment?: string;
  commentColor?: CommentColorValue;
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
    } else if (name === MARKER_COMMENT_ATTR) {
      // comment 一樣是自由格式文字，沒有固定值限制。
      result.comment = value;
    } else if (
      name === MARKER_COMMENT_COLOR_ATTR &&
      (COMMENT_COLOR_VALUES as readonly string[]).includes(value)
    ) {
      result.commentColor = value as CommentColorValue;
    }
  }
  return result;
}

/**
 * 把行內 marker 的屬性套到 run 上：巢狀時內層優先（內層已經有值就不被外層覆蓋）。
 * `markerId` 是這個行內 marker 的完整 id（含 type 前綴，例如 `footnote-a3f9`）——
 * footnote／comment 需要記住是「哪一個」實例（用來判斷連續 run 是不是同一個錨點，
 * comment 的編輯區 hover/右鍵編輯、footnote 渲染端的錨點/回連結都要靠這個 id），
 * span/a 不需要，其他屬性（顏色/連結）只看值本身就夠了，不需要記 id。
 */
function applyInlineAttrs(
  run: ParsedRun,
  attrs: InlineAttrs,
  markerId: string,
): ParsedRun {
  const isFootnote = markerId.startsWith("footnote-");
  const isComment = markerId.startsWith("comment-");
  return {
    ...run,
    textColor: run.textColor ?? attrs.textColor,
    bgColor: run.bgColor ?? attrs.bgColor,
    href: run.href ?? attrs.href,
    target: run.target ?? attrs.target,
    footnoteId: run.footnoteId ?? (isFootnote ? markerId : undefined),
    footnoteNote: run.footnoteNote ?? (isFootnote ? attrs.note : undefined),
    commentId: run.commentId ?? (isComment ? markerId : undefined),
    comment: run.comment ?? (isComment ? attrs.comment : undefined),
    commentColor:
      run.commentColor ??
      (isComment ? (attrs.commentColor ?? DEFAULT_COMMENT_COLOR) : undefined),
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

/** 兩個 run 的「格式」是否完全相同（marks 序列＋顏色＋連結＋腳注＋註解），normalizeRuns 用來決定能不能合併。 */
function sameFormatting(a: ParsedRun, b: ParsedRun): boolean {
  return (
    a.marks.length === b.marks.length &&
    a.marks.every((mark, i) => mark === b.marks[i]) &&
    a.textColor === b.textColor &&
    a.bgColor === b.bgColor &&
    a.href === b.href &&
    a.target === b.target &&
    a.footnoteId === b.footnoteId &&
    a.commentId === b.commentId
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
  content: string;
} {
  const match = line.match(MARKER_PATTERN);
  if (match && match[1] === match[4]) {
    const align = (match[2] as AlignmentValue | undefined) ?? DEFAULT_ALIGNMENT;
    return {
      markerId: match[1],
      align,
      content: match[3],
    };
  }

  // 舊格式相容（見 LEGACY_PARAGRAPH_COMMENT_PATTERN 說明）：段落 marker 上還留著舊版的
  // comment/commentColor 屬性，原地遷移成包住整段內容的合成行內 comment marker。
  const legacyMatch = line.match(LEGACY_PARAGRAPH_COMMENT_PATTERN);
  if (legacyMatch && legacyMatch[1] === legacyMatch[6]) {
    const align =
      (legacyMatch[2] as AlignmentValue | undefined) ?? DEFAULT_ALIGNMENT;
    // legacyMatch[3] 已經是跳脫過的字串（直接取自序列化格式），跟新的行內 comment marker
    // 用的是同一套跳脫規則，原樣搬過去即可，不需要先還原再重新跳脫。
    const legacyCommentAttr = legacyMatch[3];
    const legacyColor = legacyMatch[4] as CommentColorValue | undefined;
    const legacyColorAttr = legacyColor
      ? ` ${MARKER_COMMENT_COLOR_ATTR}="${legacyColor}"`
      : "";
    const wrappedContent =
      `${MARKER_OPEN}comment-legacy ${MARKER_COMMENT_ATTR}="${legacyCommentAttr}"${legacyColorAttr}${MARKER_CLOSE}` +
      legacyMatch[5] +
      `${MARKER_OPEN}${MARKER_CLOSE_SLASH}comment-legacy${MARKER_CLOSE}`;
    return {
      markerId: legacyMatch[1],
      align,
      content: wrappedContent,
    };
  }

  // 舊資料尚未跑過 marker 遷移，或內容不是本編輯器產生的：整行當純文字，id 留空由呼叫端決定怎麼補。
  return {
    markerId: null,
    align: DEFAULT_ALIGNMENT,
    content: line,
  };
}

/** 一行＝一個段落，見 whitelist.ts 的 MARKER_OPEN 說明：要跟書籤/diff 既有的逐行索引保持一致。 */
function parseLine(line: string): ParsedParagraph {
  const { headingLevel, content: afterHeading } = extractHeading(line);
  const { markerId, align, content } = extractMarker(afterHeading);
  const runs = normalizeRuns(parseInline(content));

  return { markerId, align, headingLevel, runs };
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

export interface FootnoteListEntry {
  footnoteId: string;
  /** 原始字串，可能還帶著粗體/斜體/底線的 delimiter，尚未解析。 */
  note: string;
}

export interface FootnoteNumbering {
  /** footnoteId → 讀者看到的編號（1, 2, 3...，依文件出現順序），不是 parser 內部配對
   * 開關標記用的亂數 id（那個每次序列化都會換）。 */
  numbers: Map<string, number>;
  /** 跟 numbers 同一份順序，供尾端腳注清單直接照順序渲染，不用再掃一次文件。 */
  list: FootnoteListEntry[];
}

/**
 * 依文件出現順序給整份內容（可能是一整篇故事，橫跨多個段落/標題）裡每個不重複的
 * footnoteId 編號，同時收集腳注內文。**必須用整篇故事的完整內容呼叫一次**，不能每個
 * 段落各自呼叫——閱讀頁如果是逐段落渲染（例如 Reader.tsx 要在每行掛書籤功能，一行一個
 * 渲染單位），編號跟尾端清單要靠呼叫端共用這裡算出來的同一份結果，不然每個段落會各自
 * 從 1 開始編號、甚至各自渲染一次尾端清單（腳注應該只在整篇故事的最尾端出現一次，
 * 跟內容裡有沒有標題、標題怎麼分段完全無關）。
 */
export function computeFootnoteNumbering(content: string): FootnoteNumbering {
  const paragraphs = parseMarkdownToParagraphs(content);
  const numbers = new Map<string, number>();
  const list: FootnoteListEntry[] = [];
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (run.footnoteId && !numbers.has(run.footnoteId)) {
        numbers.set(run.footnoteId, list.length + 1);
        list.push({ footnoteId: run.footnoteId, note: run.footnoteNote ?? "" });
      }
    }
  }
  return { numbers, list };
}

/**
 * 依文件順序收集這份內容裡所有腳注的「乾淨內文」（粗體/斜體/底線的 delimiter 已經拿掉，
 * 只留讀者看得到的文字），供版本 diff 頁單獨比對用——閱讀頁把腳注放在故事尾端渲染，
 * diff 也比照辦理，把腳注跟本文分開兩個區塊比對，不是把腳注文字塞進本文那一行裡。
 */
export function extractFootnoteNotesForDiff(content: string): string[] {
  return computeFootnoteNumbering(content).list.map(({ note }) =>
    parseFootnoteNoteRuns(note)
      .map((noteRun) => noteRun.text)
      .join(""),
  );
}

/**
 * 把一個 run 轉成 Tiptap 的 mark 陣列：純開關 marks（粗體等）＋帶值的顏色／連結／腳注／
 * 註解 marks。腳注／註解 mark 故意不帶 id——id 只是序列化時產生的配對用途（見
 * whitelist.ts 的 generateInlineMarkerId 說明），跟 span/a 一樣不需要存進 Tiptap
 * 文件本身的狀態。
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
  if (run.commentId) {
    marks.push({
      type: "comment",
      attrs: {
        comment: run.comment ?? "",
        commentColor: run.commentColor ?? DEFAULT_COMMENT_COLOR,
      },
    });
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
