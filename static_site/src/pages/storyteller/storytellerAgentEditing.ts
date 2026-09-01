import { formatStorytellerAgentReferenceToken } from "@/pages/storyteller/storytellerAgentReferences.ts";

// StoryEditor／LoreEditor 共用的 AI Agent 編輯行為：@story:／@lore: 引用解析與插入、
// 內文選取範圍追蹤、AI 回應套用到內文。兩個編輯器各自擁有自己的 content／selection
// 狀態，這裡只提供「怎麼算」的純邏輯，實際的 state 與畫面呈現仍留在各自的頁面元件。

export interface StorytellerAgentTextSelection {
  start: number;
  end: number;
  text: string;
}

export interface StorytellerAgentMentionInsertion {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

interface StorytellerAgentPartialMention {
  start: number;
  end: number;
  query: string;
}

export function currentStoryMentionQuery(
  value: string,
  selectionStart = value.length,
  selectionEnd = selectionStart,
): string | null {
  return (
    findPartialMention(value, selectionStart, selectionEnd, "story")?.query ??
    null
  );
}

export function currentLoreMentionQuery(
  value: string,
  selectionStart = value.length,
  selectionEnd = selectionStart,
): string | null {
  return (
    findPartialMention(value, selectionStart, selectionEnd, "lore")?.query ??
    null
  );
}

export function insertStoryMention(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  title: string,
): StorytellerAgentMentionInsertion {
  return insertMention(current, selectionStart, selectionEnd, "story", title);
}

export function insertLoreMention(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  title: string,
): StorytellerAgentMentionInsertion {
  return insertMention(current, selectionStart, selectionEnd, "lore", title);
}

function insertMention(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  kind: "story" | "lore",
  title: string,
): StorytellerAgentMentionInsertion {
  const token = formatStorytellerAgentReferenceToken(kind, title);
  const start = clampSelectionIndex(selectionStart, current.length);
  const end = clampSelectionIndex(selectionEnd, current.length);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  const partial = findPartialMention(current, rangeStart, rangeEnd, kind);
  const replaceStart = partial?.start ?? rangeStart;
  const replaceEnd = partial?.end ?? rangeEnd;
  const nextValue = `${current.slice(0, replaceStart)}${token}${current.slice(replaceEnd)}`;
  const nextSelection = replaceStart + token.length;
  return {
    value: nextValue,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
  };
}

function findPartialMention(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  kind: "story" | "lore",
): StorytellerAgentPartialMention | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }
  const cursor = clampSelectionIndex(selectionStart, value.length);
  const prefix = kind === "lore" ? "@lore:" : "@story:";
  let best: StorytellerAgentPartialMention | null = null;
  let tokenStart = value.indexOf(prefix);
  while (tokenStart >= 0 && tokenStart <= cursor) {
    const rawQueryStart = tokenStart + prefix.length;
    const bracketed = value[rawQueryStart] === "[";
    const queryStart = bracketed ? rawQueryStart + 1 : rawQueryStart;
    const queryEnd = findMentionQueryEnd(value, queryStart);
    if (cursor >= queryStart && cursor <= queryEnd) {
      best = {
        start: tokenStart,
        end: bracketed && value[queryEnd] === "]" ? queryEnd + 1 : queryEnd,
        query: value.slice(queryStart, queryEnd),
      };
    }
    tokenStart = value.indexOf(prefix, tokenStart + prefix.length);
  }
  return best;
}

function findMentionQueryEnd(value: string, queryStart: number) {
  for (let index = queryStart; index < value.length; index += 1) {
    if (/[\s\]]/.test(value[index])) {
      return index;
    }
  }
  return value.length;
}

function clampSelectionIndex(index: number, length: number) {
  if (!Number.isFinite(index)) {
    return length;
  }
  return Math.max(0, Math.min(index, length));
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
