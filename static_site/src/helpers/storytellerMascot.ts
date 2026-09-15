import type { StorytellerAppearance } from "@/data/storytellerTheme.ts";

export type StorytellerMascotPose =
  "idle" | "loading" | "success" | "error" | "thinking" | "empty";
export type StorytellerMascotSize = "256" | "512" | "master";

export function storytellerMascotSrc(
  pose: StorytellerMascotPose,
  appearance: StorytellerAppearance,
  size: StorytellerMascotSize = "512",
) {
  return `/storyteller/suosuo-${pose}-${appearance}-${size}.png`;
}

export const STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES = 3;

export function storytellerMascotLoadingSpriteSrc(
  appearance: StorytellerAppearance,
) {
  return `/storyteller/suosuo-loading-sprite-${appearance}.png`;
}
