import { createContext, useContext } from "react";

export type StorytellerThemeMode = "light" | "dark";

export const storytellerThemeModeStorageKey = "storyteller-theme-mode";

// 讀取上次選擇；尚未選過時依系統偏好決定初始值
export function getInitialStorytellerThemeMode(): StorytellerThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(storytellerThemeModeStorageKey);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface StorytellerThemeModeContextValue {
  mode: StorytellerThemeMode;
  toggleMode: () => void;
}

// 由 StorytellerLayout 提供，讓整個 Storyteller 產品線（不影響其他子站）共用同一份深色模式狀態
export const StorytellerThemeModeContext =
  createContext<StorytellerThemeModeContextValue | null>(null);

export function useStorytellerThemeMode() {
  const context = useContext(StorytellerThemeModeContext);
  if (!context) {
    throw new Error(
      "useStorytellerThemeMode must be used within StorytellerLayout",
    );
  }
  return context;
}
