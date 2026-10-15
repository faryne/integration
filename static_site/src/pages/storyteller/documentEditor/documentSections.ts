import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygCore/parser.ts";

// 「編輯範圍」：只編輯文件裡的某一章。章的範圍比照維基百科的段落編輯——從這個標題開始，
// 到下一個「同級或更高級」的標題為止（底下的小節一起帶進來）。
// 範圍以行為單位：內容一律用 split("\n") 切（跟 parser、書籤的 line_index 同一套），
// 用 parser 的段落行號找標題，跨行的 code block 裡的 # 不會被當成標題。

export interface DocumentSection {
  markerId: string;
  level: number;
  title: string;
  start: number;
  // 行數（含標題那一行）
  count: number;
}

export function listDocumentSections(content: string): DocumentSection[] {
  const lineCount = content.split("\n").length;
  const headings = parseMarkdownToParagraphs(content, { enableAssets: false })
    .filter((paragraph) => paragraph.headingLevel > 0 && paragraph.markerId)
    .map((paragraph) => ({
      markerId: paragraph.markerId!,
      level: paragraph.headingLevel,
      title: paragraph.runs
        .map((run) => run.text)
        .join("")
        .trim(),
      start: paragraph.sourceLineIndex ?? 0,
    }));
  return headings.map((heading, index) => {
    const next = headings
      .slice(index + 1)
      .find((each) => each.level <= heading.level);
    return { ...heading, count: (next?.start ?? lineCount) - heading.start };
  });
}

// 從全文切出 [start, start + count) 這幾行
export const sliceLines = (content: string, start: number, count: number) =>
  content
    .split("\n")
    .slice(start, start + count)
    .join("\n");

// 把編輯後的那一段接回全文，回傳新的全文與這一段新的行數
export function spliceLines(
  content: string,
  start: number,
  count: number,
  replacement: string,
) {
  const lines = content.split("\n");
  const next = replacement.split("\n");
  return {
    content: [
      ...lines.slice(0, start),
      ...next,
      ...lines.slice(start + count),
    ].join("\n"),
    count: next.length,
  };
}
