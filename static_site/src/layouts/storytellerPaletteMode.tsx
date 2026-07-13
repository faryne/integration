import { createContext, useContext } from "react";
import {
  storytellerPaletteMeta,
  type StorytellerPaletteName,
} from "@/data/storytellerTheme.ts";

export const storytellerPaletteStorageKey = "storyteller-theme-palette";

// 讀取上次選擇的色系；尚未選過或存的值不是目前支援的色系名稱時用預設的黃銅——
// 用 storytellerPaletteMeta 的 key 判斷合法性，色系新增/移除時這裡不用跟著改。
export function getInitialStorytellerPalette(): StorytellerPaletteName {
  if (typeof window === "undefined") {
    return "brass";
  }
  const stored = window.localStorage.getItem(storytellerPaletteStorageKey);
  if (stored && stored in storytellerPaletteMeta) {
    return stored as StorytellerPaletteName;
  }
  return "brass";
}

interface StorytellerPaletteContextValue {
  palette: StorytellerPaletteName;
  setPalette: (palette: StorytellerPaletteName) => void;
}

// 由 StorytellerLayout 提供，讓整個 Storyteller 產品線共用同一份色系選擇狀態
export const StorytellerPaletteContext =
  createContext<StorytellerPaletteContextValue | null>(null);

export function useStorytellerPalette() {
  const context = useContext(StorytellerPaletteContext);
  if (!context) {
    throw new Error(
      "useStorytellerPalette must be used within StorytellerLayout",
    );
  }
  return context;
}
