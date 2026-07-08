import type { ReactNode } from "react";
import { Box } from "@mui/material";

import {
  parseMarkdownToParagraphs,
  type ParsedRun,
} from "./wysiwygCore/parser";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import type { MarkName } from "./wysiwygCore/whitelist";

interface StorytellerWysiwygMarkdownProps {
  children: string;
}

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
 * 所見即所得編輯器的白名單解析器版本 StorytellerMarkdown，介面刻意相容
 * （同樣吃 `children: string`），給故事內容的所有閱讀端（編輯頁預覽面板、公開
 * 閱讀頁、版本 diff）共用同一套解析結果——不是重新實作一套規則，是直接呼叫
 * wysiwygCore/parser.ts 的 parseMarkdownToParagraphs，跟編輯器本身用同一份邏輯。
 *
 * 只給「故事內容」（可能含新 marker 語法）這種來源用；LoreEditor／AI Agent
 * 面板／使用者簡介這些還沒換新編輯器產生內容的地方，繼續用原本的
 * StorytellerMarkdown（remark-gfm），不要混著換。
 */
export function StorytellerWysiwygMarkdown({
  children,
}: StorytellerWysiwygMarkdownProps) {
  const paragraphs = parseMarkdownToParagraphs(children);

  return (
    <Box sx={HEADING_TYPOGRAPHY_SX}>
      {paragraphs.map((paragraph, index) => {
        const HeadingOrParagraphTag =
          paragraph.headingLevel > 0
            ? (`h${paragraph.headingLevel}` as keyof React.JSX.IntrinsicElements)
            : "p";
        return (
          <HeadingOrParagraphTag
            key={paragraph.markerId ?? index}
            style={{ textAlign: paragraph.align }}
          >
            {paragraph.runs.length === 0
              ? " "
              : paragraph.runs.map((run, runIndex) => renderRun(run, runIndex))}
          </HeadingOrParagraphTag>
        );
      })}
    </Box>
  );
}
