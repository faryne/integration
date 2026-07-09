import type { ReactNode } from "react";

import { parseFootnoteNoteRuns, type ParsedRun } from "./parser";

/**
 * 腳注內文的共用渲染邏輯：把限縮過的行內樣式（粗體/斜體/底線，見 whitelist.ts 的
 * FOOTNOTE_MARK_NAMES）渲染成對應的 HTML 標籤。編輯區的 hover tooltip 跟閱讀頁的
 * 腳注清單都呼叫這個函式，兩邊看到的格式要一致。
 */

const FOOTNOTE_MARK_TAG: Record<
  "bold" | "italic" | "underline",
  keyof React.JSX.IntrinsicElements
> = {
  bold: "strong",
  italic: "em",
  underline: "u",
};

function renderFootnoteRun(run: ParsedRun, key: number): ReactNode {
  let node: ReactNode = run.text;
  for (const mark of run.marks) {
    if (mark !== "bold" && mark !== "italic" && mark !== "underline") continue;
    const Tag = FOOTNOTE_MARK_TAG[mark];
    node = <Tag key={`${key}-${mark}`}>{node}</Tag>;
  }
  return <span key={key}>{node}</span>;
}

export function renderFootnoteNote(note: string): ReactNode {
  return parseFootnoteNoteRuns(note).map((run, index) =>
    renderFootnoteRun(run, index),
  );
}
