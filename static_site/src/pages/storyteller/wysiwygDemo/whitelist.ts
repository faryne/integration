/**
 * 所見即所得編輯器的語法白名單設定檔。
 *
 * 這是唯一應該被序列化/解析邏輯參考的規則來源；新增或調整語法時只需要改這個檔案。
 * 見 DevelopDocuments/storyteller/所見即所得編輯器.md 的「語法白名單」章節。
 */

export type MarkName =
  | "bold"
  | "italic"
  | "underline"
  | "subscript"
  | "superscript";

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

export const ALIGN_BLOCK_OPEN = ":::";
export const ALIGN_BLOCK_CLOSE = ":::";

/** 段落 marker 包住整個段落內容，系統保留、使用者不可鍵入、渲染時完全隱藏。刻意不用 HTML，避免和「不接受 HTML」規則衝突。 */
export const MARKER_OPEN = "⟦";
export const MARKER_CLOSE = "⟧";
export const MARKER_CLOSE_SLASH = "/";

/** 段落最多一則註解，內嵌成 marker 開始標記上的屬性：⟦markerId comment="..."⟧。 */
export const MARKER_COMMENT_ATTR = "comment";

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
