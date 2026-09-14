import { createContext, useContext } from "react";
import {
  storytellerAppearanceMeta,
  type StorytellerAppearance,
} from "@/data/storytellerTheme.ts";

export const storytellerAppearanceStorageKey = "storyteller-appearance";
const legacyModeStorageKey = "storyteller-theme-mode";
const legacyPaletteStorageKey = "storyteller-theme-palette";
const legacySeasonStorageKey = "storyteller-theme-season";

/** 舊版 palette 不再影響外觀，只依原本明暗偏好遷移，避免擅自猜測使用者想要稜光。 */
export function getInitialStorytellerAppearance(): StorytellerAppearance {
  if (typeof window === "undefined") return "nocturne";

  const stored = window.localStorage.getItem(storytellerAppearanceStorageKey);
  if (stored && stored in storytellerAppearanceMeta) {
    return stored as StorytellerAppearance;
  }

  const legacyMode = window.localStorage.getItem(legacyModeStorageKey);
  if (legacyMode === "light") return "ivory";
  if (legacyMode === "dark") return "nocturne";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "ivory"
    : "nocturne";
}

export function removeLegacyStorytellerAppearancePreferences() {
  window.localStorage.removeItem(legacyModeStorageKey);
  window.localStorage.removeItem(legacyPaletteStorageKey);
  window.localStorage.removeItem(legacySeasonStorageKey);
}

interface StorytellerAppearanceContextValue {
  appearance: StorytellerAppearance;
  setAppearance: (appearance: StorytellerAppearance) => void;
}

export const StorytellerAppearanceContext =
  createContext<StorytellerAppearanceContextValue | null>(null);

export function useStorytellerAppearance() {
  const context = useContext(StorytellerAppearanceContext);
  if (!context) {
    throw new Error(
      "useStorytellerAppearance must be used within StorytellerLayout",
    );
  }
  return context;
}
