/**
 * 所見即所得編輯器的語法白名單設定檔。
 *
 * 這是唯一應該被序列化/解析邏輯參考的規則來源；新增或調整語法時只需要改這個檔案。
 * 見 DevelopDocuments/storyteller/所見即所得編輯器.md 的「語法白名單」章節。
 */

export type MarkName =
  "bold" | "italic" | "underline" | "subscript" | "superscript";

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
 * 段落 marker 包住整個段落內容，系統保留、使用者不可鍵入、渲染時完全隱藏。刻意不用 HTML，避免和「不接受 HTML」規則衝突。
 *
 * 段落之間用單一 `\n` 分隔（不是空行）：故事閱讀頁的書籤功能（line_index）跟版本 diff
 * （逐行比對）都是直接對 `content.split("\n")` 的陣列位置定位，「一行＝一個段落」
 * 必須跟這個既有假設保持一致，否則舊資料 migrate 過來後書籤/diff 的索引全部對不上。
 *
 * 對齊（align）跟註解（comment）都是這個 marker 開始標記上的屬性，不是另外的行首前綴語法——
 * 兩者本質上都是「掛在這個段落上的中繼資料」，讓 marker 當成統一的屬性容器比另外發明一套
 * 前綴規則更一致，而且屬性天生就活在同一行裡，完全不會跟「一行＝一個段落」的限制衝突。
 * 固定順序：`⟦markerId align="center" comment="..." commentColor="pink"⟧內容⟦/markerId⟧`
 * （align 在前、comment 在後、commentColor 殿後），三個屬性都可省略（省略時分別代表置左、
 * 沒有註解、預設色）。commentColor 只有在有 comment 時才有意義。
 */
export const MARKER_OPEN = "⟦";
export const MARKER_CLOSE = "⟧";
export const MARKER_CLOSE_SLASH = "/";

export const MARKER_ALIGN_ATTR = "align";
/** 段落最多一則註解，內嵌成 marker 開始標記上的屬性：⟦markerId comment="..."⟧。 */
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

/** 把註解文字裡的反斜線／雙引號跳脫，才能安全塞進 `comment="..."` 屬性字串。順序：反斜線一定要先跳脫。 */
export function escapeMarkerComment(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** escapeMarkerComment 的反向操作：把 `\X` 還原成 `X`，不管 X 是什麼字元。 */
export function unescapeMarkerComment(escaped: string): string {
  return escaped.replace(/\\(.)/g, "$1");
}

/* ------------------------------------------------------------------ *
 * 行內 marker（inline marker）
 *
 * 跟上面的「段落 marker」用同一組括號（⟦⟧）跟跳脫規則，但兩者是分開的機制：
 * - 段落 marker 包住「整行」（parser 用 `^...$` 比對），帶的是段落層級屬性
 *   （align／comment／commentColor），id 是純 UUID。
 * - 行內 marker 包住「段落內容裡的一段選取文字」（在 parseInline 階段處理），
 *   帶的是行內元素屬性（文字顏色 textColor／bgColor，之後還有腳注、連結），
 *   id 前面一定有 `<type>-` 前綴（例如 `span-`），parser 靠這個前綴判斷種類，
 *   也讓行內 marker 跟段落 marker（純 UUID、無前綴）天生可區分。
 *
 * 語法：`⟦<type>-<id> attr="..."⟧被套用的文字⟦/<type>-<id>⟧`
 * id 只需要在「同一行內」唯一（行內 marker 不跨行），open/close 靠完整的
 * `<type>-<id>` 字串配對，所以巢狀／相鄰時也不會配錯。id 每次序列化重新產生
 * （diff 端一律先 strip marker，id 變動不會造成假差異）。
 * ------------------------------------------------------------------ */

/** 目前支援的行內 marker 種類。之後加腳注時往這裡加一個值即可。 */
export const INLINE_MARKER_TYPES = ["span", "a"] as const;
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
