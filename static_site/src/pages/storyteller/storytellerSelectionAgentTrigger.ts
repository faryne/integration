import type { StorytellerAgentRunMode } from "@/types/storyteller.ts";

export interface StorytellerSelectionAgentTrigger {
  mode: StorytellerAgentRunMode;
  selectedText: string;
  instruction: string;
}

// 跟「指令 / 引用說明」抽屜（StorytellerAgentReferenceDrawer.tsx）共用同一份文案，
// 避免兩個地方各自寫一份說明之後各自漂移走樣。
export const STORYTELLER_SKILL_USAGE_TEXT: Record<string, string> = {
  rewrite: "把選取或整段內容改寫成不同寫法，語氣風格盡量維持不變。",
  expand: "延伸現有內容，補細節、加長篇幅，不改變原本走向。",
  translate: "翻譯成指定語言；沒指定語言時預設翻成繁體中文。",
  continue: "接續目前內容繼續往下寫，不重複已有的部分。",
  custom: "不套用固定模式，照你打的指令自由處理。",
};

// 右鍵選字觸發 AI 指令時，只在 UI 顯示短預覽；真正送出的 selected_content
// 保留完整原文，避免把使用者選到的段落內容混進 slash command 字串。
export function truncateStorytellerSelectionPreview(
  value: string,
  maxCharacters = 50,
) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxCharacters) {
    return normalized || "（空白）";
  }
  return `${chars.slice(0, maxCharacters).join("")}...`;
}
