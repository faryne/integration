import type { StorytellerAgentRunMode } from "@/types/storyteller.ts";

export interface StorytellerSelectionAgentTrigger {
  mode: StorytellerAgentRunMode;
  selectedText: string;
  instruction: string;
  /** 問 AI 的來源範圍；舊呼叫端沒帶時視為選取文字，維持相容。 */
  scope?: "selection" | "block" | "document";
  /** 段落 marker 只用來在 UI 標示錨點，不送進模型。 */
  markerId?: string;
}

// 值是翻譯 key（web.agent.scope.*），呼叫端用 t() 顯示
export const STORYTELLER_AI_SCOPE_LABELS = {
  selection: "web.agent.scope.selection",
  block: "web.agent.scope.block",
  document: "web.agent.scope.document",
} as const;

// 跟「指令 / 引用說明」抽屜（StorytellerAgentReferenceDrawer.tsx）共用同一份文案，
// 避免兩個地方各自寫一份說明之後各自漂移走樣。值是翻譯 key（web.agent.skills.*.usage）。
export const STORYTELLER_SKILL_USAGE_TEXT: Record<string, string> = {
  rewrite: "web.agent.skills.rewrite.usage",
  expand: "web.agent.skills.expand.usage",
  translate: "web.agent.skills.translate.usage",
  continue: "web.agent.skills.continue.usage",
  custom: "web.agent.skills.custom.usage",
};

// 右鍵選字觸發 AI 指令時，只在 UI 顯示短預覽；真正送出的 selected_content
// 保留完整原文，避免把使用者選到的段落內容混進 slash command 字串。
// emptyLabel：選到的全是空白時顯示的文字（由呼叫端帶入翻譯後字串）。
export function truncateStorytellerSelectionPreview(
  value: string,
  emptyLabel: string,
  maxCharacters = 50,
) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxCharacters) {
    return normalized || emptyLabel;
  }
  return `${chars.slice(0, maxCharacters).join("")}...`;
}
