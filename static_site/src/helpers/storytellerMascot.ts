import type { StorytellerAppearance } from "@/data/storytellerTheme.ts";
import {
  STORYTELLER_ASSISTANT_EXPRESSIONS,
  type StorytellerAssistantExpression,
} from "@/types/storyteller.ts";

export const STORYTELLER_MASCOT_CDN_BASE =
  "https://cdn.faryne.dev/steamloom_assets";

const storytellerAssistantExpressionSet = new Set<string>(
  STORYTELLER_ASSISTANT_EXPRESSIONS,
);

export function normalizeStorytellerAssistantExpression(
  value: unknown,
): StorytellerAssistantExpression {
  return typeof value === "string" &&
    storytellerAssistantExpressionSet.has(value)
    ? (value as StorytellerAssistantExpression)
    : "neutral";
}

// 對話頭像統一用 suosuo-avatar-{expression}-256.png，之後新增表情不用再猜命名。
export function storytellerAssistantAvatarSrc(
  expression: StorytellerAssistantExpression = "neutral",
) {
  return `${STORYTELLER_MASCOT_CDN_BASE}/suosuo-avatar-${expression}-256.png`;
}

export const STORYTELLER_ASSISTANT_AVATAR_SRC = storytellerAssistantAvatarSrc();
export const STORYTELLER_ASSISTANT_THINKING_GIF_SRC = `${STORYTELLER_MASCOT_CDN_BASE}/suosuo-loading-thinking-v1-256.gif`;

export type StorytellerMascotPose =
  "idle" | "loading" | "success" | "error" | "thinking" | "empty";
export type StorytellerMascotSize = "256" | "512" | "master";
export type StorytellerDialogMascotState =
  "danger" | "success" | "thinking" | "neutral";

export function storytellerMascotSrc(
  pose: StorytellerMascotPose,
  appearance: StorytellerAppearance,
  size: StorytellerMascotSize = "512",
) {
  return `${STORYTELLER_MASCOT_CDN_BASE}/suosuo-${pose}-${appearance}-${size}.png`;
}

// Dialog 狀態圖與一般 pose 分開命名，避免把執行失敗的 error 誤用成危險操作提醒。
export function storytellerDialogMascotSrc(
  state: StorytellerDialogMascotState,
  appearance: StorytellerAppearance,
  size: StorytellerMascotSize = "512",
) {
  return `${STORYTELLER_MASCOT_CDN_BASE}/suosuo-dialog-${state}-${appearance}-${size}.png`;
}

export const STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES = 3;

export function storytellerMascotLoadingSpriteSrc(
  appearance: StorytellerAppearance,
) {
  return `${STORYTELLER_MASCOT_CDN_BASE}/suosuo-loading-sprite-${appearance}.png`;
}
