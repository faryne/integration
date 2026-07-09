import { useId, type CSSProperties, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import { BG_COLOR_CSS, TEXT_COLOR_CSS } from "./wysiwygCore/colorStyles";
import { renderFootnoteNote } from "./wysiwygCore/footnoteRender";
import {
  parseMarkdownToParagraphs,
  type ParsedRun,
} from "./wysiwygCore/parser";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import { isSafeHref, type MarkName } from "./wysiwygCore/whitelist";

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
  // 文字顏色／背景色：值一律取自固定色盤的對照表（colorStyles.ts），不是把序列化字串
  // 原樣塞進 style，符合「不接受使用者自填 CSS」的安全規則。
  const style: CSSProperties = {};
  if (run.textColor) style.color = TEXT_COLOR_CSS[run.textColor];
  if (run.bgColor) style.backgroundColor = BG_COLOR_CSS[run.bgColor];
  if (style.color || style.backgroundColor) {
    node = (
      <span key={`${key}-color`} style={style}>
        {node}
      </span>
    );
  }
  // 連結：parser 已經檢查過 scheme，這裡渲染前再檢查一次（防禦性、不假設上一層
  // 一定擋過）——每一層都要各自驗證，不能只靠其中一關。target=_blank 一定要配
  // rel="noopener noreferrer"，防止新分頁透過 window.opener 回頭操作原本頁面。
  if (run.href && isSafeHref(run.href)) {
    return (
      <a
        key={key}
        href={run.href}
        target={run.target}
        rel={run.target === "_blank" ? "noopener noreferrer" : undefined}
      >
        {node}
      </a>
    );
  }
  return <span key={key}>{node}</span>;
}

/**
 * 一個段落的 runs 裡，連續幾個 run 只要 footnoteId 相同就代表同一個腳注錨點（例如錨定
 * 文字裡有一段粗體，會被拆成兩個 run，但都掛著同一個 footnoteId）——只在這組的最後一個
 * run 之後插入一次上標編號連結，不是每個 run 各插一次。
 *
 * anchorId／noteId 都是「instanceId + footnoteId」組出來的 DOM id：光用 footnoteId
 * 不夠，因為同一頁可能同時渲染這個元件兩次（例如版本 diff 頁面左右並排），兩份 id
 * 剛好相同的機率雖然極低，但也不該假設「同一頁只會有一個 StorytellerWysiwygMarkdown
 * 實例」；useId() 保證每個實例的前綴不同。
 */
function renderParagraphRuns(
  runs: ParsedRun[],
  footnoteNumbers: Map<string, number>,
  anchorId: (footnoteId: string) => string,
  noteId: (footnoteId: string) => string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  runs.forEach((run, index) => {
    nodes.push(renderRun(run, index));
    const isLastOfFootnoteGroup =
      run.footnoteId && run.footnoteId !== runs[index + 1]?.footnoteId;
    if (isLastOfFootnoteGroup && run.footnoteId) {
      const number = footnoteNumbers.get(run.footnoteId);
      nodes.push(
        <sup key={`${index}-footnote-ref`}>
          <a id={anchorId(run.footnoteId)} href={`#${noteId(run.footnoteId)}`}>
            [{number}]
          </a>
        </sup>,
      );
    }
  });
  return nodes;
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
  const instanceId = useId();

  // 第一輪：依文件出現順序給每個不重複的 footnoteId 編號——讀者看到的是 1, 2, 3...，
  // 不是 parser 內部用來配對開關標記的亂數 id（那個每次序列化都會換）。同時把腳注內文
  // 收集起來，尾端腳注清單直接複用這份順序，不用再掃一次文件。
  const footnoteNumbers = new Map<string, number>();
  const footnoteList: { footnoteId: string; note: string }[] = [];
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (run.footnoteId && !footnoteNumbers.has(run.footnoteId)) {
        footnoteNumbers.set(run.footnoteId, footnoteList.length + 1);
        footnoteList.push({
          footnoteId: run.footnoteId,
          note: run.footnoteNote ?? "",
        });
      }
    }
  }
  const anchorId = (footnoteId: string) =>
    `${instanceId}fn-anchor-${footnoteId}`;
  const noteId = (footnoteId: string) => `${instanceId}fn-note-${footnoteId}`;

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
              : renderParagraphRuns(
                  paragraph.runs,
                  footnoteNumbers,
                  anchorId,
                  noteId,
                )}
          </HeadingOrParagraphTag>
        );
      })}

      {footnoteList.length > 0 && (
        <Box
          component="section"
          sx={{
            mt: 3,
            pt: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            腳注
          </Typography>
          <Box component="ol" sx={{ m: 0, pl: 3 }}>
            {footnoteList.map(({ footnoteId, note }) => (
              <Typography
                key={footnoteId}
                component="li"
                variant="body2"
                id={noteId(footnoteId)}
              >
                <a href={`#${anchorId(footnoteId)}`}>{"↩"}</a>{" "}
                {renderFootnoteNote(note)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
