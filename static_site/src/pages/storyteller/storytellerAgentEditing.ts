import { formatStorytellerAgentReferenceToken } from "@/pages/storyteller/storytellerAgentReferences.ts";
import type { StorytellerContentBlock } from "@/pages/storyteller/storytellerEditorSync.ts";
import {
  findStorytellerBlockIndexByOffset,
  scrollStorytellerPreviewBlockIntoView,
} from "@/pages/storyteller/storytellerEditorSync.ts";
import type { StorytellerEditorSidePanel } from "@/pages/storyteller/StorytellerEditorSideTabs.tsx";

// StoryEditor／LoreEditor 共用的 AI Agent 編輯行為：@story:／@lore: 引用解析與插入、
// 內文選取範圍追蹤、AI 回應套用到內文。兩個編輯器各自擁有自己的 content／selection
// 狀態，這裡只提供「怎麼算」的純邏輯，實際的 state 與畫面呈現仍留在各自的頁面元件。

export interface StorytellerAgentTextSelection {
  start: number;
  end: number;
  text: string;
}

export function currentStoryMentionQuery(value: string): string | null {
  const match = value.match(/@story:([^\s\]]*)$/);
  return match ? match[1] : null;
}

export function currentLoreMentionQuery(value: string): string | null {
  const match = value.match(/@lore:([^\s\]]*)$/);
  return match ? match[1] : null;
}

export function insertStoryMention(current: string, title: string): string {
  const token = formatStorytellerAgentReferenceToken("story", title);
  if (/@story:([^\s\]]*)$/.test(current)) {
    return current.replace(/@story:([^\s\]]*)$/, token);
  }
  return current.trimEnd() ? `${current.trimEnd()} ${token}` : token;
}

export function insertLoreMention(current: string, title: string): string {
  const token = formatStorytellerAgentReferenceToken("lore", title);
  if (/@lore:([^\s\]]*)$/.test(current)) {
    return current.replace(/@lore:([^\s\]]*)$/, token);
  }
  return current.trimEnd() ? `${current.trimEnd()} ${token}` : token;
}

// 更新目前的內文選取範圍；預覽分頁開啟時同步捲動預覽到對應段落
export function updateStorytellerSelection({
  target,
  sidePanel,
  previewBlocks,
  previewScrollContainer,
  setSelectionState,
}: {
  target: HTMLTextAreaElement | null;
  sidePanel: StorytellerEditorSidePanel;
  previewBlocks: StorytellerContentBlock[];
  previewScrollContainer: HTMLElement | null;
  setSelectionState: (selection: StorytellerAgentTextSelection) => void;
}) {
  if (!target) {
    return;
  }
  const start = target.selectionStart;
  const end = target.selectionEnd;
  const text = target.value.slice(start, end);
  setSelectionState({ start, end, text });

  if (sidePanel === "preview") {
    const blockIndex = findStorytellerBlockIndexByOffset(previewBlocks, start);
    scrollStorytellerPreviewBlockIntoView(previewScrollContainer, blockIndex);
  }
}

// 將 AI 回應套用回內文：取代選取／插入游標／附加末尾／複製。
// 通知與後續動作（複製成功、選取範圍已變更、套用完成）透過 callback 交給呼叫端決定怎麼呈現，
// 讓這個函式維持跟頁面 UI 無關的純邏輯。
export function applyStorytellerAgentText({
  result,
  action,
  content,
  resultSelection,
  target,
  setContent,
  onCopy,
  onSelectionMismatch,
  onAfterApply,
}: {
  result: string;
  action: "replace" | "insert" | "append" | "copy";
  content: string;
  resultSelection: StorytellerAgentTextSelection | null;
  target: HTMLTextAreaElement | null;
  setContent: (value: string | ((current: string) => string)) => void;
  onCopy?: () => void;
  onSelectionMismatch?: () => void;
  onAfterApply?: () => void;
}) {
  const text = result.trim();
  if (!text) {
    return;
  }
  if (action === "copy") {
    void navigator.clipboard.writeText(text);
    onCopy?.();
    return;
  }
  if (action === "append") {
    setContent(
      (value) => `${value}${value.endsWith("\n") ? "" : "\n\n"}${text}`,
    );
    return;
  }
  if (action === "insert") {
    const cursor = target?.selectionStart ?? content.length;
    setContent(`${content.slice(0, cursor)}${text}${content.slice(cursor)}`);
    window.requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(cursor, cursor + text.length);
      onAfterApply?.();
    });
    return;
  }
  if (!resultSelection) {
    return;
  }
  const currentSelectedText = content.slice(
    resultSelection.start,
    resultSelection.end,
  );
  if (currentSelectedText !== resultSelection.text) {
    onSelectionMismatch?.();
    return;
  }
  const nextContent = `${content.slice(0, resultSelection.start)}${text}${content.slice(resultSelection.end)}`;
  setContent(nextContent);
  window.requestAnimationFrame(() => {
    target?.focus();
    target?.setSelectionRange(
      resultSelection.start,
      resultSelection.start + text.length,
    );
    onAfterApply?.();
  });
}
