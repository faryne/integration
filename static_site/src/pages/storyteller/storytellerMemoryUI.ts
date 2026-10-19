import { useTranslation } from "react-i18next";
import type {
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

// 記憶相關元件共用同一組翻譯與格式化方法，避免管理頁、編輯器與草稿確認視窗各自拼字串。
export function useStorytellerMemoryUI() {
  const { t } = useTranslation();
  const scopeLabels: Record<StorytellerAssistantMemoryScope, string> = {
    project: t("writer:memory.scopeLabels.project"),
    story: t("writer:memory.scopeLabels.story"),
    lore: t("writer:memory.scopeLabels.lore"),
  };
  const contextScopeLabels: Record<StorytellerAssistantMemoryScope, string> = {
    project: t("writer:memory.contextScopeLabels.project"),
    story: t("writer:memory.contextScopeLabels.story"),
    lore: t("writer:memory.contextScopeLabels.lore"),
  };
  const kindLabels: Record<StorytellerAssistantMemoryKind, string> = {
    preference: t("writer:memory.kindLabels.preference"),
    instruction: t("writer:memory.kindLabels.instruction"),
    decision: t("writer:memory.kindLabels.decision"),
    context: t("writer:memory.kindLabels.context"),
  };
  const kindDescriptions: Record<StorytellerAssistantMemoryKind, string> = {
    preference: t("writer:memory.kindDescriptions.preference"),
    instruction: t("writer:memory.kindDescriptions.instruction"),
    decision: t("writer:memory.kindDescriptions.decision"),
    context: t("writer:memory.kindDescriptions.context"),
  };

  function targetLabel(
    scope: StorytellerAssistantMemoryScope,
    targetName?: string,
  ) {
    if (scope === "project" || !targetName) return scopeLabels[scope];
    return t("writer:memory.target", {
      scope: scopeLabels[scope],
      name: targetName,
    });
  }

  function errorMessage(error: unknown) {
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
    return t("writer:memory.operationFailed");
  }

  return {
    contextScopeLabels,
    errorMessage,
    kindDescriptions,
    kindLabels,
    scopeLabels,
    targetLabel,
  };
}
