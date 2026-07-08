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
