import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { caretBlock } from "@/pages/storyteller/wysiwygCore/caretFocus.ts";
import { findParagraphPosByMarkerId } from "@/pages/storyteller/wysiwygCore/jumpToMarker.ts";
import {
  listDocumentSections,
  sliceLines,
  spliceLines,
} from "@/pages/storyteller/documentEditor/documentSections.ts";
import type { DocumentEditingState } from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

// 只編輯某一章：編輯器拿到的是那幾行，改了再接回全文交給 useDocumentEditing（存檔一樣存整篇）。
// 範圍以「切換當下的行範圍」記，之後跟著編輯增減行數；在這一段裡新增或刪除標題不會讓畫面突然跳掉。
// 全文被外部換掉（重新載入、回復版本、AI 套用）時用 markerId 重新定位，找不到就回到全文。
// 每篇記住上次的範圍（本機），下次打開直接回到那一章。
// 切換範圍時游標跟著走：原本那一段在新範圍裡就回到同一段同一個位置，不在就放到新範圍開頭，捲到畫面中間並保留焦點。

interface Scope {
  markerId: string;
  start: number;
  count: number;
}

const storageKey = (memoryKey: string) => `steamloom.editor.scope.${memoryKey}`;
// 標題行（# 開頭）的粗略計數，決定要不要顯示範圍選單；每次打字都跑，不能用完整解析
const HEADING_LINE = /^#{1,6} /gm;

const locate = (content: string, markerId: string): Scope | null => {
  const section = listDocumentSections(content).find(
    (each) => each.markerId === markerId,
  );
  return section
    ? { markerId, start: section.start, count: section.count }
    : null;
};

export function useDocumentScope({
  editing,
  memoryKey,
  editor,
}: {
  editing: DocumentEditingState;
  // 每篇文件唯一的 key，給了才記住範圍
  memoryKey?: string;
  editor: Editor | null;
}) {
  const content = editing.draft.content;
  const [scope, setScopeState] = useState<Scope | null>(() => {
    if (!memoryKey) return null;
    try {
      const saved = window.localStorage.getItem(storageKey(memoryKey));
      return saved ? locate(content, saved) : null;
    } catch {
      return null;
    }
  });
  // onChange 可能在 re-render 前連續觸發，範圍與全文都以 ref 為準
  const scopeRef = useRef(scope);
  const contentRef = useRef(content);
  // 這份全文是自己接回去的（不是外部換掉的）
  const ownContentRef = useRef(content);
  // 切換範圍後要把游標放到哪一段（markerId）的第幾個字
  const pendingCaretRef = useRef<{ markerId: string; offset: number } | null>(
    null,
  );

  const setScope = (next: Scope | null) => {
    scopeRef.current = next;
    setScopeState(next);
    if (!memoryKey) return;
    try {
      if (next)
        window.localStorage.setItem(storageKey(memoryKey), next.markerId);
      else window.localStorage.removeItem(storageKey(memoryKey));
    } catch {
      // 無痕模式等存不了就算了
    }
  };

  // 全文被外部換掉：重新定位這一段
  useEffect(() => {
    contentRef.current = content;
    if (content === ownContentRef.current) return;
    ownContentRef.current = content;
    const current = scopeRef.current;
    if (current) setScope(locate(content, current.markerId));
  }, [content]);

  // 換範圍後把游標放回去。編輯器換內容是在子元件（StorytellerWysiwygEditor）的 effect 裡同步做的，
  // 輪到這裡時已經換好，直接放游標、捲動就好，不等下一幀（rAF 在背景或節流時可能慢上一秒）。
  // 只看範圍換到哪一章；同一章裡打字只會改行數，不會觸發
  const scopeMarkerId = scope?.markerId ?? null;
  useEffect(() => {
    const target = pendingCaretRef.current;
    if (!target || !editor || editor.isDestroyed) return;
    pendingCaretRef.current = null;
    const { doc } = editor.state;
    const found = findParagraphPosByMarkerId(doc, target.markerId);
    // 不在新範圍裡：放到開頭（範圍的標題）
    const pos = found ?? 0;
    const end = pos + (doc.nodeAt(pos)?.nodeSize ?? 2) - 1;
    const offset = found === null ? 0 : target.offset;
    // 先 focus 再放游標、捲動：直接對編輯區 focus 會把捲動容器捲回開頭（見 jumpToMarker.ts）
    editor.view.dom.focus({ preventScroll: true });
    editor.commands.setTextSelection(Math.min(pos + 1 + offset, end));
    (editor.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({
      block: "center",
    });
  }, [scopeMarkerId, editor]);

  // 記下目前游標在哪一段的第幾個字，切換範圍後放回去
  const rememberCaret = () => {
    if (!editor || editor.isDestroyed) return;
    const block = caretBlock(editor.state);
    const markerId = block?.node.attrs.markerId as string | undefined;
    pendingCaretRef.current =
      block && markerId
        ? { markerId, offset: editor.state.selection.head - (block.pos + 1) }
        : null;
  };

  const onChange = (next: string) => {
    const current = scopeRef.current;
    let full = next;
    if (current) {
      const spliced = spliceLines(
        contentRef.current,
        current.start,
        current.count,
        next,
      );
      full = spliced.content;
      scopeRef.current = { ...current, count: spliced.count };
      setScopeState(scopeRef.current);
    }
    contentRef.current = full;
    ownContentRef.current = full;
    editing.setContent(full);
  };

  return {
    // 交給編輯器的內容：全文或那一段
    value: scope ? sliceLines(content, scope.start, scope.count) : content,
    onChange,
    activeMarkerId: scope?.markerId ?? null,
    // 至少兩個標題才有切範圍的意義
    available:
      Boolean(scope) || (content.match(HEADING_LINE)?.length ?? 0) >= 2,
    sections: () => listDocumentSections(contentRef.current),
    select: (markerId: string | null) => {
      rememberCaret();
      setScope(markerId ? locate(contentRef.current, markerId) : null);
    },
    // 書籤在全文裡、但不在目前這一段
    isOutside: (markerId: string) =>
      Boolean(scopeRef.current) && contentRef.current.includes(`⟦${markerId}⟧`),
    // 範圍外的書籤：回到全文，游標放到那一段開頭
    jumpOutside: (markerId: string) => {
      pendingCaretRef.current = { markerId, offset: 0 };
      setScope(null);
    },
  };
}

export type DocumentScopeState = ReturnType<typeof useDocumentScope>;
