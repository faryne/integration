/**
 * 所見即所得編輯器的語法白名單設定檔。
 *
 * 這是唯一應該被序列化/解析邏輯參考的規則來源；新增或調整語法時只需要改這個檔案。
 * 見 DevelopDocuments/storyteller/所見即所得編輯器.md 的「語法白名單」章節。
 */

export type MarkName =
  "bold" | "italic" | "underline" | "subscript" | "superscript" | "strike";

export interface MarkSyntaxRule {
  markName: MarkName;
  /** 解析時允許識別的所有寫法（別名），例如粗體同時允許 ** 和 __。 */
  delimiters: string[];
  /** 序列化輸出時採用的正式寫法。 */
  canonicalDelimiter: string;
}

export const MARK_SYNTAX_WHITELIST: MarkSyntaxRule[] = [
  { markName: "bold", delimiters: ["**", "__"], canonicalDelimiter: "**" },
  { markName: "underline", delimiters: ["++"], canonicalDelimiter: "++" },
  { markName: "strike", delimiters: ["--"], canonicalDelimiter: "--" },
  { markName: "italic", delimiters: ["*"], canonicalDelimiter: "*" },
  { markName: "subscript", delimiters: ["~"], canonicalDelimiter: "~" },
  { markName: "superscript", delimiters: ["^"], canonicalDelimiter: "^" },
];

export interface FlatDelimiter {
  markName: MarkName;
  delimiter: string;
}

/** 解析器逐字掃描時要用的候選 delimiter 清單，長的寫法必須排在前面（例如 ** 要早於 *），避免誤判。 */
export const PARSE_DELIMITERS: FlatDelimiter[] = MARK_SYNTAX_WHITELIST.flatMap(
  (rule) =>
    rule.delimiters.map((delimiter) => ({
      markName: rule.markName,
      delimiter,
    })),
).sort((a, b) => b.delimiter.length - a.delimiter.length);

export const ALIGNMENT_VALUES = ["left", "center", "right"] as const;
export type AlignmentValue = (typeof ALIGNMENT_VALUES)[number];
export const DEFAULT_ALIGNMENT: AlignmentValue = "left";

/** 0 代表一般段落（非標題）。語法是行首的 `#` 到 `######`，比照 CommonMark ATX heading。 */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = 0 | (typeof HEADING_LEVELS)[number];
export const DEFAULT_HEADING_LEVEL: HeadingLevel = 0;

/**
 * 段落種類（引用/清單），跟標題一樣走行首前綴（2026-07-10 定案，見
 * DevelopDocuments/storyteller/所見即所得編輯器_issue.md 的「實作方向」）：
 * 引用 `> `、無序清單項目 `- `、有序清單項目「數字 + `. `」。這是一個**跟
 * `headingLevel` 分開**的段落屬性，不是把 headingLevel 擴充成聯合型別——標題現有的
 * input rule／鍵盤快速鍵／渲染邏輯已經上線在用，分開一個屬性比重構風險低。兩者互斥：
 * 一個段落只能是「標題」或「引用/清單」其中一種，序列化時只會輸出其中一種前綴（見
 * serializer.ts），切換時另一種要重置成預設值（見 markerParagraph.ts 的
 * setBlockKind／setHeadingLevel 命令）。第一版不支援巢狀引用/清單。
 */
export const BLOCK_KIND_VALUES = [
  "none",
  "quote",
  "bullet",
  "number",
  "hr",
  "table-row",
] as const;
export type BlockKindValue = (typeof BLOCK_KIND_VALUES)[number];
export const DEFAULT_BLOCK_KIND: BlockKindValue = "none";

export const BLOCK_KIND_QUOTE_PREFIX = "> ";
export const BLOCK_KIND_BULLET_PREFIX = "- ";
/**
 * 分隔線（水平線），2026-08-08 加入。跟引用/清單不同，這個 blockKind 的段落本身不接受
 * 任何行內內容——語法只是行首固定的 `---`，沒有「前綴 + 後面接內容」的概念（見
 * markerParagraph.ts 的 insertHorizontalRule 命令：套用時會強制清空該段落文字，並自動
 * 在後面插入一個新段落把游標移過去，使用者不需要、也不應該對著分隔線那一行繼續打字）。
 */
export const BLOCK_KIND_HR_PREFIX = "---";
/**
 * 有序清單一律自動編號：解析時接受任何「數字 + `. `」（不要求數字連續正確，使用者
 * 打字、或編輯過程中插入/刪除項目時不需要手動調整後面項目的數字），但存進去的數字
 * 本身沒有意義、序列化輸出一律用這個固定的 canonical 前綴——真正顯示的編號完全交給
 * 渲染端的原生 `<ol>` 處理，不用自己算，也不會有「插入一項、後面全部要重新編號」的
 * 維護負擔。
 */
export const BLOCK_KIND_NUMBER_CANONICAL_PREFIX = "1. ";
/** 解析有序清單前綴用的寬鬆比對規則（任何數字＋`. `），跟上面固定輸出的 canonical 前綴分開。 */
export const BLOCK_KIND_NUMBER_PARSE_PATTERN = /^\d+\. /;

/**
 * 表格列，2026-08-08 加入。跟引用/清單一樣是「前綴 + 後面接內容」，但內容本身還有一層
 * 「用 `|` 分隔儲存格」的結構——這一層刻意不放進解析器（parser.ts 的 ParsedParagraph 仍然
 * 只有扁平的 `runs`，跟其他 blockKind 一樣），改成在渲染端（StorytellerWysiwygMarkdown.tsx
 * 的 splitRunsIntoCells）對「已經解析完粗體/顏色等行內語法之後」的 ParsedRun[] 依
 * `run.text` 裡的字面 `|` 字元切欄位。這是刻意的順序：如果反過來在「還沒解析行內語法的
 * 原始字串」上直接用 `|` 切，會誤切到 footnote/連結等 marker 屬性值（`note="..."`／
 * `href="..."`）裡剛好含有的 `|` 字元，把 marker 語法切壞；解析完的 run 裡，屬性值是
 * 獨立欄位（run.footnoteNote／run.href 等），不會混進 run.text，這時候切才安全。也因此
 * 編輯器裡打字時的體驗很單純：`|` 就是一個普通字元，使用者自己輸入 `|` 來分隔欄位，
 * 編輯區不會、也不需要真的長出表格網格（真正的 <table> 巢狀 DOM 只在閱讀頁渲染）。
 */
export const BLOCK_KIND_TABLE_ROW_PREFIX = "|";

/** 依 blockKind 回傳序列化/diff 顯示要用的行首前綴，`"none"` 回傳空字串。parser.ts
 * 的 stripMarkerForDiffLine 跟 serializer.ts 的 serializeParagraph 共用同一份規則。 */
export function blockKindPrefix(blockKind: BlockKindValue): string {
  switch (blockKind) {
    case "quote":
      return BLOCK_KIND_QUOTE_PREFIX;
    case "bullet":
      return BLOCK_KIND_BULLET_PREFIX;
    case "number":
      return BLOCK_KIND_NUMBER_CANONICAL_PREFIX;
    case "hr":
      return BLOCK_KIND_HR_PREFIX;
    case "table-row":
      return BLOCK_KIND_TABLE_ROW_PREFIX;
    default:
      return "";
  }
}

/**
 * 段落 marker 包住整個段落內容，系統保留、使用者不可鍵入、渲染時完全隱藏。刻意不用 HTML，避免和「不接受 HTML」規則衝突。
 *
 * 段落之間用單一 `\n` 分隔（不是空行）：故事閱讀頁的書籤功能（line_index）跟版本 diff
 * （逐行比對）都是直接對 `content.split("\n")` 的陣列位置定位，「一行＝一個段落」
 * 必須跟這個既有假設保持一致，否則舊資料 migrate 過來後書籤/diff 的索引全部對不上。
 *
 * 對齊（align）是這個 marker 開始標記上的屬性，不是另外的行首前綴語法——這是「掛在整個
 * 段落上的中繼資料」，讓 marker 當成統一的屬性容器比另外發明一套前綴規則更一致。
 * 固定順序：`⟦markerId align="center"⟧內容⟦/markerId⟧`，可省略（省略代表置左）。
 *
 * 註解（comment）原本也內嵌在這個段落 marker 上，2026-07-09 改成跟文字顏色/連結/腳注一樣
 * 走「行內 marker」機制（見下面），因為使用者可能只想針對段落裡的一小段文字加註解，不一定
 * 是整個段落——`MARKER_COMMENT_ATTR`／`MARKER_COMMENT_COLOR_ATTR`／`COMMENT_COLOR_VALUES`
 * 這些常數本身不變，只是現在被行內 marker 的 `comment-<id>` 消費，不再出現在段落 marker上。
 */
export const MARKER_OPEN = "⟦";
export const MARKER_CLOSE = "⟧";
export const MARKER_CLOSE_SLASH = "/";

export const MARKER_ALIGN_ATTR = "align";
export const TABLE_MARKER_NAME = "table";
export const TABLE_MARKER_TABLE_ID_ATTR = "tableId";
export const TABLE_MARKER_ROW_ID_ATTR = "rowId";
/** 註解文字，行內 marker（`type="comment"`）的屬性：⟦comment-<id> comment="..."⟧。 */
export const MARKER_COMMENT_ATTR = "comment";
/**
 * 註解底色，固定幾種偏亮色系可選，不開放自訂顏色值。省略時代表預設色（第一個值），
 * 讓還沒有這個屬性的舊資料（本功能上線前建立的註解）維持原本看到的顏色。
 */
export const MARKER_COMMENT_COLOR_ATTR = "commentColor";
export const COMMENT_COLOR_VALUES = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
] as const;
export type CommentColorValue = (typeof COMMENT_COLOR_VALUES)[number];
export const DEFAULT_COMMENT_COLOR: CommentColorValue = "yellow";

export function generateMarkerId(): string {
  return crypto.randomUUID();
}

export function generateTableId(): string {
  return `tbl_${crypto.randomUUID()}`;
}

export function generateTableRowId(): string {
  return `row_${crypto.randomUUID()}`;
}

/**
 * 把註解文字裡的反斜線／雙引號／換行跳脫，才能安全塞進 `comment="..."` 屬性字串。
 * 順序固定：反斜線一定要最先跳脫，換行（\r/\n）一定要最後跳脫——不然真換行跳脫出來的
 * `\n` 兩個字元會被反斜線那步再跳脫一次，變成 `\\n`。
 *
 * 換行一定要跳脫，因為 parser（parser.ts 的 parseMarkdownToParagraphs）是用
 * `content.split("\n")` 把 markdown 切成一行一段落，屬性值裡若留著真正的換行字元，
 * 會把這個 marker 的開頭跟收尾標記切到不同「行」去，解析端因此找不到收尾、整段
 * fallback 成顯示原始 marker 語法（曾經在 prod 重現過的 bug）。
 */
export function escapeMarkerComment(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/** escapeMarkerComment 的反向操作：`\n`／`\r` 還原成真正的換行／回車，其餘 `\X` 還原成 `X`。 */
export function unescapeMarkerComment(escaped: string): string {
  return escaped.replace(/\\(.)/g, (_match, char: string) => {
    if (char === "n") return "\n";
    if (char === "r") return "\r";
    return char;
  });
}

/**
 * 真表格 cell 內容的第二層跳脫。這層只處理「列格式」需要的三種字元：
 * - `\` → `\\`
 * - cell 邊界字元 `|` → `\|`
 * - cell 內換行 → `\n`
 *
 * 行內 marker 屬性值（例如 comment/note/href）會先由 escapeMarkerComment 處理，再經過
 * 這層 table escape；解析時反過來先 table unescape，再交給既有 inline parser。
 */
export function escapeTableCell(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "\\n");
}

/** escapeTableCell 的反向操作；其他反斜線組合保持字面值，不做額外解讀。 */
export function unescapeTableCell(text: string): string {
  let output = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char !== "\\" || index === text.length - 1) {
      output += char;
      continue;
    }
    const next = text[index + 1];
    if (next === "|" || next === "\\") {
      output += next;
      index++;
    } else if (next === "n") {
      output += "\n";
      index++;
    } else {
      output += char;
    }
  }
  return output;
}

/* ------------------------------------------------------------------ *
 * 行內 marker（inline marker）
 *
 * 跟上面的「段落 marker」用同一組括號（⟦⟧）跟跳脫規則，但兩者是分開的機制：
 * - 段落 marker 包住「整行」（parser 用 `^...$` 比對），帶的是段落層級屬性
 *   （目前只剩 align），id 是純 UUID。
 * - 行內 marker 包住「段落內容裡的一段選取文字」（在 parseInline 階段處理），
 *   帶的是行內元素屬性（文字顏色 textColor／bgColor、連結 href/target、腳注
 *   note、註解 comment/commentColor），id 前面一定有 `<type>-` 前綴（例如
 *   `span-`），parser 靠這個前綴判斷種類，也讓行內 marker 跟段落 marker
 *   （純 UUID、無前綴）天生可區分。
 *
 * 語法：`⟦<type>-<id> attr="..."⟧被套用的文字⟦/<type>-<id>⟧`
 * id 只需要在「同一行內」唯一（行內 marker 不跨行），open/close 靠完整的
 * `<type>-<id>` 字串配對，所以巢狀／相鄰時也不會配錯。id 每次序列化重新產生
 * （diff 端一律先 strip marker，id 變動不會造成假差異）。
 * ------------------------------------------------------------------ */

/** 目前支援的行內 marker 種類。 */
export const INLINE_MARKER_TYPES = [
  "span",
  "a",
  "footnote",
  "comment",
] as const;
export type InlineMarkerType = (typeof INLINE_MARKER_TYPES)[number];

/** 產生行內 marker 的 id：`<type>-<短亂數>`。只需在同一行內唯一即可。 */
export function generateInlineMarkerId(type: InlineMarkerType): string {
  // 8 碼 36 進位亂數，同一行內夠唯一了，不用像段落 marker 那樣塞整個 UUID。
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${type}-${nonce}`;
}

/* --- span（文字樣式）行內 marker 的屬性 --- */

export const MARKER_TEXT_COLOR_ATTR = "textColor";
export const MARKER_BG_COLOR_ATTR = "bgColor";

/**
 * 文字前景色色盤：飽和度較高、對比明顯的語意色，適合當文字顏色。
 * 固定選項、不開放自填 CSS 值（值 → 實際色碼的對照表放在渲染端，見
 * StorytellerWysiwygEditor.tsx／StorytellerWysiwygMarkdown.tsx）。
 */
export const TEXT_COLOR_VALUES = [
  "red",
  "orange",
  "green",
  "blue",
  "purple",
] as const;
export type TextColorValue = (typeof TEXT_COLOR_VALUES)[number];

/**
 * 文字背景色色盤：偏淡的底色，文字疊上去還讀得到（比照 commentColor 的淡色路線）。
 * 一樣固定選項、不開放自填。
 */
export const BG_COLOR_VALUES = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
] as const;
export type BgColorValue = (typeof BG_COLOR_VALUES)[number];

/* --- asset image（資產圖片）段落內容 --- */

export const ASSET_URI_PREFIX = "steamloom-asset://";
export const ASSET_PUBLIC_ID_PATTERN_SOURCE = "[A-Za-z0-9._~-]+";
const ASSET_URI_PATTERN = new RegExp(
  `^${ASSET_URI_PREFIX}(${ASSET_PUBLIC_ID_PATTERN_SOURCE})$`,
);

export function assetPublicIdFromUri(uri: string): string | null {
  return uri.match(ASSET_URI_PATTERN)?.[1] ?? null;
}

export function sanitizeMarkdownImageAlt(alt: string): string {
  return alt
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/[\n\r]/g, " ");
}

/* --- a（連結）行內 marker 的屬性 --- */

export const MARKER_HREF_ATTR = "href";
export const MARKER_TARGET_ATTR = "target";

/** 目前只支援「開新分頁」這個值；省略代表同分頁開啟（預設）。 */
export const LINK_TARGET_VALUES = ["_blank"] as const;
export type LinkTargetValue = (typeof LINK_TARGET_VALUES)[number];

/**
 * 網址不像顏色可以走固定色盤（本質上就是自由格式的值），這裡的資安防線是限制 scheme，
 * 不是限制值本身：只接受明確以 `http://` 或 `https://` 開頭的網址，擋掉 `javascript:`／
 * `data:`／`vbscript:` 這類會在點擊時執行內容的危險 scheme。
 *
 * 刻意不接受「沒有 scheme 的相對路徑」（也就是站內連結，例如連到同專案裡的另一篇
 * 故事／設定集）——不是技術上做不到，是產品面還沒決定：站內連結牽涉到「故事是否公開」
 * 「設定集目前還沒有公開機制」這些還沒拍板的問題，先只支援明確的外部網址，等使用情境
 * 明朗後再評估要不要開放（見 DevelopDocuments/storyteller/所見即所得編輯器_issue.md）。
 *
 * 這裡只擋 scheme，不驗證網址「看起來正不正確」；渲染成 `<a href>` 時 React 本來就會
 * 正確跳脫屬性值，所以 XSS 風險只在 scheme 這一關，不需要更嚴格的網址格式驗證。
 * 呼叫端（編輯器輸入驗證、parser 解析既有資料、渲染端輸出前）都要各自呼叫這個檢查，
 * 任何一關漏了都不能假設別的地方已經擋過。
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/* --- footnote（腳注）行內 marker 的屬性 --- */

/** 腳注沒有 id 屬性——跟 span/a 一樣，marker 本身的 id（`footnote-<nonce>`）只在序列化時
 * 產生，不是段落 marker 那種需要跨編輯階段保持穩定的東西，見 generateInlineMarkerId 的說明。 */
export const MARKER_NOTE_ATTR = "note";

/**
 * 腳注內文刻意限縮格式範圍：只接受粗體/斜體/底線，不像段落本文那樣還開放上下標
 * （腳注通常是補充說明的短文字，允許的樣式範圍比照大部分排版慣例，故意比正文窄）。
 * `parseFootnoteNoteRuns`（parser.ts）跟 Go 後端的字數計算都要用同一份限縮清單，
 * 兩邊算出來的「乾淨字數」才會一致。
 */
export const FOOTNOTE_MARK_NAMES: MarkName[] = ["bold", "italic", "underline"];

/** parseFootnoteNoteRuns 逐字掃描時要用的候選 delimiter 清單，跟 PARSE_DELIMITERS 同一個
 * 排序規則（長的在前），只是先篩掉腳注不支援的上下標。 */
export const FOOTNOTE_PARSE_DELIMITERS: FlatDelimiter[] =
  PARSE_DELIMITERS.filter((delimiter) =>
    FOOTNOTE_MARK_NAMES.includes(delimiter.markName),
  );
