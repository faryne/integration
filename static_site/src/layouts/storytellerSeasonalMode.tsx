import { createContext, useContext } from "react";
import {
  storytellerSeasonalThemes,
  type StorytellerSeasonId,
} from "@/data/storytellerSeasonalTheme.ts";

export const storytellerSeasonalStorageKey = "storyteller-theme-season";

// 讀取上次選擇的節慶主題；尚未選過或存的值不是目前支援的節慶時預設「無」——
// 跟 palette/mode 兩個 context 同一套邏輯，見 storytellerPaletteMode.tsx。
export function getInitialStorytellerSeason(): StorytellerSeasonId {
  if (typeof window === "undefined") {
    return "none";
  }
  const stored = window.localStorage.getItem(storytellerSeasonalStorageKey);
  if (stored && stored in storytellerSeasonalThemes) {
    return stored as StorytellerSeasonId;
  }
  return "none";
}

interface StorytellerSeasonalContextValue {
  season: StorytellerSeasonId;
  setSeason: (season: StorytellerSeasonId) => void;
}

// 由 StorytellerLayout 提供，讓整個 Storyteller 產品線共用同一份節慶主題選擇狀態
export const StorytellerSeasonalContext =
  createContext<StorytellerSeasonalContextValue | null>(null);

export function useStorytellerSeason() {
  const context = useContext(StorytellerSeasonalContext);
  if (!context) {
    throw new Error(
      "useStorytellerSeason must be used within StorytellerLayout",
    );
  }
  return context;
}
