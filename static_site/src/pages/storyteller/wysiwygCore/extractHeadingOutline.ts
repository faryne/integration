import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { HeadingLevel } from "./whitelist";

/** 標題大綱項目：從內容算出來的結構，不落資料庫。 */
export interface HeadingOutlineItem {
  markerId: string;
  level: HeadingLevel;
  text: string;
  /** ProseMirror 文件位置（節點起點），用來跟書籤合併排序／跳轉。 */
  pos: number;
}

/** 任一有 markerId 的段落目前在文件裡的位置，給書籤對照 pos 用。 */
export interface ParagraphMarkerPosition {
  markerId: string;
  text: string;
  pos: number;
  headingLevel: HeadingLevel;
}

export interface DocumentMarkerIndex {
  headings: HeadingOutlineItem[];
  paragraphs: Map<string, ParagraphMarkerPosition>;
}

function paragraphText(node: ProseMirrorNode): string {
  return node.textContent.replace(/\s+/g, " ").trim();
}

/**
 * 一次 descendants 掃完整份文件：標題清單 + 所有段落 marker 位置。
 * 書籤要知道目前 pos 才能跟標題依文件順序合併，不要分開掃兩次。
 */
export function extractDocumentMarkers(
  doc: ProseMirrorNode,
): DocumentMarkerIndex {
  const headings: HeadingOutlineItem[] = [];
  const paragraphs = new Map<string, ParagraphMarkerPosition>();
  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    const markerId = node.attrs.markerId as string | null;
    if (!markerId) return;
    const headingLevel = (node.attrs.headingLevel ?? 0) as HeadingLevel;
    const text = paragraphText(node);
    paragraphs.set(markerId, {
      markerId,
      text,
      pos,
      headingLevel,
    });
    if (headingLevel > 0) {
      headings.push({ markerId, level: headingLevel, text, pos });
    }
  });
  return { headings, paragraphs };
}

/** 收集 headingLevel > 0 的段落，作為編輯頁大綱。 */
export function extractHeadingOutline(
  doc: ProseMirrorNode,
): HeadingOutlineItem[] {
  return extractDocumentMarkers(doc).headings;
}
