import {
  computeFootnoteNumbering,
  groupParagraphsByBlockKind,
  parseFootnoteNoteRuns,
  parseMarkdownToParagraphs,
  splitRunsIntoCells,
  type ParsedParagraph,
  type ParsedRun,
} from "./parser";
import {
  ASSET_URI_PREFIX,
  sanitizeMarkdownImageAlt,
  type MarkName,
} from "./whitelist";

/**
 * 「自訂白名單語法 → 標準 markdown」匯出轉換器。
 *
 * DB 裡存的 content 是我們的自訂語法（段落 marker `⟦id⟧`、行內 marker、自創
 * delimiter），直接存成 .md 會把內部語法洩漏給使用者。這裡直接吃
 * `parseMarkdownToParagraphs()` 的結構化輸出重組成標準 markdown——不重寫任何
 * 解析邏輯，所有語法理解都複用既有 parser（「編輯器與閱讀頁共用同一套解析器」
 * 設計的紅利）。
 *
 * 轉換規則（見 issue 文件的對照表）：
 * - 標題/引用/無序清單前綴：本來就是標準語法，原樣輸出。
 * - 有序清單：重新編出真正的連續數字（匯出檔是給人看原始碼的，這是唯一
 *   「數字有意義」的地方；內部儲存永遠是 canonical 的 `1. `）。
 * - 粗體 `**`／斜體 `*`／刪除線 `~~`：標準/GFM 語法直接輸出；底線/上下標標準 markdown
 *   沒有對應語法，轉行內 HTML `<u>`/`<sub>`/`<sup>`（GFM 及多數渲染器接受）。
 * - 文字顏色/背景色：剝掉樣式、保留文字（標準 markdown 無對應，匯出檔保持乾淨）。
 * - 連結：`[文字](網址)`；target 丟棄。
 * - 腳注：GFM 腳注語法——內文錨點 `[^n]`＋檔案尾端 `[^n]: 內文` 清單，編號沿用
 *   閱讀頁同一套 `computeFootnoteNumbering()`。
 * - 註解：整個剝掉（含註解文字）——那是作者自用的編輯備忘，匯出檔不該洩漏。
 *
 * 已知限制（刻意接受）：本文裡「字面上的 `*`/`~` 等字元」（在我們的 parser 裡因
 * 不成對而被當純文字）匯出後可能被標準渲染器解讀成格式，第一版不做 markdown
 * escaping（發生機率低、規則瑣碎）。
 */

/** 由外而內的包裹順序，跟 serializer.ts 的 MARK_NESTING_ORDER_OUTER_TO_INNER 一致，輸出才穩定。 */
const EXPORT_MARK_ORDER_OUTER_TO_INNER: MarkName[] = [
  "bold",
  "underline",
  "strike",
  "italic",
  "subscript",
  "superscript",
];

const EXPORT_MARK_WRAPPERS: Record<MarkName, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["<u>", "</u>"],
  subscript: ["<sub>", "</sub>"],
  superscript: ["<sup>", "</sup>"],
  // 刪除線是少數標準 GFM 有對應語法的樣式（~~文字~~），不用像底線/上下標退回 HTML。
  strike: ["~~", "~~"],
};

function wrapWithMarks(text: string, marks: MarkName[]): string {
  let output = text;
  // 由內而外套：反向走 outer-to-inner 清單，最外層（bold）最後包。
  for (const mark of [...EXPORT_MARK_ORDER_OUTER_TO_INNER].reverse()) {
    if (marks.includes(mark)) {
      const [open, close] = EXPORT_MARK_WRAPPERS[mark];
      output = `${open}${output}${close}`;
    }
  }
  return output;
}

/**
 * 匯出時兩個相鄰 run 能不能併成一段文字：只看匯出後還存在的格式（marks／連結／
 * 腳注群組）。顏色/註解在匯出時會被剝掉，原本只因顏色不同而被拆開的兩個粗體 run
 * 如果不先合併，會輸出成 `**a****b**` 這種標準渲染器會誤判的相鄰 delimiter。
 */
function sameExportFormatting(a: ParsedRun, b: ParsedRun): boolean {
  return (
    !a.assetPublicId &&
    !b.assetPublicId &&
    a.marks.length === b.marks.length &&
    a.marks.every((mark, i) => mark === b.marks[i]) &&
    a.href === b.href &&
    a.footnoteId === b.footnoteId
  );
}

function mergeRunsForExport(runs: ParsedRun[]): ParsedRun[] {
  const merged: ParsedRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && sameExportFormatting(last, run)) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/** 腳注內文轉標準 markdown（限縮語法：只有粗體/斜體/底線，跟閱讀頁渲染同一套規則）。 */
function exportFootnoteNote(note: string): string {
  return parseFootnoteNoteRuns(note)
    .map((run) => wrapWithMarks(run.text, run.marks))
    .join("");
}

/** 一個段落的行內內容轉標準 markdown（不含行首前綴）。 */
function exportInline(
  runs: ParsedRun[],
  footnoteNumbers: Map<string, number>,
): string {
  const merged = mergeRunsForExport(runs);
  let output = "";
  merged.forEach((run, index) => {
    if (run.assetPublicId) {
      output += `![${sanitizeMarkdownImageAlt(run.assetAlt ?? "")}](${ASSET_URI_PREFIX}${run.assetPublicId})`;
      return;
    }
    if (run.assetSrc) {
      output += `![${sanitizeMarkdownImageAlt(run.assetAlt ?? "")}](${run.assetSrc})`;
      return;
    }
    let piece = wrapWithMarks(run.text, run.marks);
    if (run.href) {
      piece = `[${piece}](${run.href})`;
    }
    output += piece;
    // 連續同 footnoteId 的 run 是同一個腳注錨點，只在整組最後補一次 [^n]
    // （跟閱讀頁 renderParagraphRuns 的分組邏輯一致）。
    const isLastOfFootnoteGroup =
      run.footnoteId && run.footnoteId !== merged[index + 1]?.footnoteId;
    if (isLastOfFootnoteGroup && run.footnoteId) {
      output += `[^${footnoteNumbers.get(run.footnoteId)}]`;
    }
  });
  return output;
}

interface ExportGroup {
  blockKind: ParsedParagraph["blockKind"] | "code";
  tableId?: string;
  paragraphs: ParsedParagraph[];
}

const TABLE_SEPARATOR_CELL_PATTERN = /^:?-+:?$/;

/** 連續同 blockKind（引用/清單/表格）的段落分成一組，"none" 各自獨立——跟閱讀頁的分組規則一致。 */
function groupForExport(paragraphs: ParsedParagraph[]): ExportGroup[] {
  return groupParagraphsByBlockKind(paragraphs).map((group) => ({
    blockKind: group.blockKind === "table" ? "table-row" : group.blockKind,
    tableId: group.tableId,
    paragraphs: group.items.map(({ paragraph }) => paragraph),
  }));
}

function isExportTableSeparatorRow(cells: ParsedRun[][]): boolean {
  return cells.every((cell) =>
    TABLE_SEPARATOR_CELL_PATTERN.test(
      cell
        .map((run) => run.text)
        .join("")
        .trim(),
    ),
  );
}

function exportTableCell(
  runs: ParsedRun[],
  footnoteNumbers: Map<string, number>,
): string {
  return exportInline(runs, footnoteNumbers)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function exportTableRows(
  rows: ParsedRun[][][],
  footnoteNumbers: Map<string, number>,
): string {
  const visibleRows = rows.filter((row, index) => {
    if (index === 1 && isExportTableSeparatorRow(row)) return false;
    return !isExportTableSeparatorRow(row);
  });
  if (visibleRows.length === 0) return "";

  const columnCount = Math.max(1, ...visibleRows.map((row) => row.length));
  const lines = visibleRows.map((row) => {
    const cells = Array.from({ length: columnCount }, (_, cellIndex) =>
      exportTableCell(row[cellIndex] ?? [], footnoteNumbers),
    );
    return `| ${cells.join(" | ")} |`;
  });
  const separator = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
  return [lines[0], separator, ...lines.slice(1)].join("\n");
}

/**
 * 把自訂語法的 content 轉成一份標準 markdown 字串。
 * 段落之間用空行分隔（標準 markdown 的段落分隔），同一組引用/清單內的行用單一
 * 換行相連（拆開會變成多個獨立的 blockquote／清單）；內部儲存用的「空段落當
 * 行距」在標準 markdown 裡沒有意義（連續空行會被渲染器收合），直接略過。
 */
export function exportContentToMarkdown(content: string): string {
  const paragraphs = parseMarkdownToParagraphs(content);
  const footnoteNumbering = computeFootnoteNumbering(content);

  const blocks: string[] = [];
  for (const group of groupForExport(paragraphs)) {
    if (group.tableId) {
      const table = exportTableRows(
        group.paragraphs.map((paragraph) => paragraph.tableCells ?? [[]]),
        footnoteNumbering.numbers,
      );
      if (table) blocks.push(table);
      continue;
    }

    if (group.blockKind === "code") {
      const paragraph = group.paragraphs[0];
      const language = (paragraph.language ?? "").trim();
      const content = paragraph.runs.map((run) => run.text).join("");
      blocks.push(`\`\`\`${language}\n${content}\n\`\`\``);
      continue;
    }

    if (group.blockKind === "none") {
      const paragraph = group.paragraphs[0];
      const inline = exportInline(paragraph.runs, footnoteNumbering.numbers);
      if (inline.trim() === "") continue;
      const headingPrefix =
        paragraph.headingLevel > 0
          ? `${"#".repeat(paragraph.headingLevel)} `
          : "";
      blocks.push(`${headingPrefix}${inline}`);
      continue;
    }

    if (group.blockKind === "table-row") {
      const table = exportTableRows(
        group.paragraphs.map((paragraph) => splitRunsIntoCells(paragraph.runs)),
        footnoteNumbering.numbers,
      );
      if (table) blocks.push(table);
      continue;
    }

    const lines = group.paragraphs.map((paragraph, index) => {
      const inline = exportInline(paragraph.runs, footnoteNumbering.numbers);
      const prefix =
        group.blockKind === "quote"
          ? "> "
          : group.blockKind === "bullet"
            ? "- "
            : `${index + 1}. `;
      return `${prefix}${inline}`;
    });
    blocks.push(lines.join("\n"));
  }

  if (footnoteNumbering.list.length > 0) {
    blocks.push(
      footnoteNumbering.list
        .map(
          ({ footnoteId, note }) =>
            `[^${footnoteNumbering.numbers.get(footnoteId)}]: ${exportFootnoteNote(note)}`,
        )
        .join("\n"),
    );
  }

  return blocks.join("\n\n") + "\n";
}

/** 匯出檔名：`[標題]_[timestamp].md`，標題裡的檔名保留字元換成底線，空標題用「未命名」。 */
export function buildExportFileName(title: string): string {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, "_") || "未命名";
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${safeTitle}_${timestamp}.md`;
}
