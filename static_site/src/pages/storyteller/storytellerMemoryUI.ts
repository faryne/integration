import type {
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

export const storytellerMemoryScopeLabels: Record<
  StorytellerAssistantMemoryScope,
  string
> = {
  account: "所有專案",
  project: "目前專案",
  story: "這篇故事",
  lore: "這則設定",
};

export const storytellerMemoryKindLabels: Record<
  StorytellerAssistantMemoryKind,
  string
> = {
  preference: "偏好",
  instruction: "持續指示",
  decision: "已確認決策",
  context: "背景資訊",
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
