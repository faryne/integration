import type {
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

export const storytellerMemoryScopeLabels: Record<
  StorytellerAssistantMemoryScope,
  string
> = {
  project: "整個專案",
  story: "故事",
  lore: "設定",
};

// 只有從故事／設定編輯器發起操作時，「這篇／這則」才有明確指涉。
export const storytellerMemoryContextScopeLabels: Record<
  StorytellerAssistantMemoryScope,
  string
> = {
  project: "整個專案",
  story: "這篇故事",
  lore: "這則設定",
};

// 專案層管理頁要直接帶出目標名稱，不能用失去上下文的「這篇／這則」。
export function storytellerMemoryTargetLabel(
  scope: StorytellerAssistantMemoryScope,
  targetName?: string,
) {
  if (scope === "project") return storytellerMemoryScopeLabels.project;
  return targetName
    ? `${storytellerMemoryScopeLabels[scope]}：${targetName}`
    : storytellerMemoryScopeLabels[scope];
}

export const storytellerMemoryKindLabels: Record<
  StorytellerAssistantMemoryKind,
  string
> = {
  preference: "偏好",
  instruction: "持續指示",
  decision: "已確認決策",
  context: "背景資訊",
};

export const storytellerMemoryKindDescriptions: Record<
  StorytellerAssistantMemoryKind,
  string
> = {
  preference: "偏好的寫作、格式或互動方式，例如「回覆簡潔一點」。",
  instruction: "之後都要持續遵守的要求或限制，例如「不要改動角色名稱」。",
  decision: "已經確認、不必反覆討論的決定，例如「第三章改成雨夜」。",
  context: "理解內容所需的長期背景，例如角色關係或世界觀前提。",
};

export function storytellerMemoryErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    if (data.message) return data.message;
  }
  return "記憶操作失敗，請稍後再試。";
}
