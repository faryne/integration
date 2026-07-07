import { Box } from "@mui/material";
import type { ReactNode } from "react";

import { parseMarkdownToParagraphs, type ParsedRun } from "./parser";
import type { MarkName } from "./whitelist";

const MARK_TAG: Record<MarkName, keyof React.JSX.IntrinsicElements> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  subscript: "sub",
  superscript: "sup",
};

function renderRun(run: ParsedRun, key: number): ReactNode {
  let node: ReactNode = run.text;
  for (const mark of run.marks) {
    const Tag = MARK_TAG[mark];
    node = <Tag key={`${key}-${mark}`}>{node}</Tag>;
  }
  return <span key={key}>{node}</span>;
}

/**
 * 故事閱讀頁未來要共用的正是這個解析結果——這裡刻意重新呼叫 parseMarkdownToParagraphs，
 * 而不是直接讀 Tiptap 的 doc state，用來驗證「編輯器與閱讀頁共用同一套解析器」這件事：
 * 不管輸入是編輯器目前的內容，還是之後從資料庫讀回來的純 markdown 字串，結果都一致。
 */
export function Preview({ markdown }: { markdown: string }) {
  const paragraphs = parseMarkdownToParagraphs(markdown);

  return (
    <Box sx={{ "& p": { margin: 0, minHeight: "1.5em" } }}>
      {paragraphs.map((paragraph, index) => (
        <p key={paragraph.markerId ?? index} style={{ textAlign: paragraph.align }}>
          {paragraph.runs.length === 0
            ? " "
            : paragraph.runs.map((run, runIndex) => renderRun(run, runIndex))}
        </p>
      ))}
    </Box>
  );
}
