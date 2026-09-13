import { useState } from "react";

const STORAGE_KEY = "storyteller-reader-preferences";

export type ReaderFontSize = 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;
export type ReaderLineHeight = 1.7 | 1.95 | 2.2;
export type ReaderMeasure = 640 | 720 | 820;
export type ReaderFontFamily = "system" | "sans" | "serif";

export const READER_FONT_FAMILIES: Record<ReaderFontFamily, string> = {
  system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  sans: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  serif: '"Noto Serif TC", "Songti TC", PMingLiU, serif',
};

export interface StorytellerReaderPreferences {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  measure: ReaderMeasure;
  fontFamily: ReaderFontFamily;
}

const DEFAULT_PREFERENCES: StorytellerReaderPreferences = {
  fontSize: 18,
  lineHeight: 1.95,
  measure: 720,
  fontFamily: "system",
};

const VALID_FONT_SIZES: ReaderFontSize[] = [
  15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
];
const VALID_LINE_HEIGHTS: ReaderLineHeight[] = [1.7, 1.95, 2.2];
const VALID_MEASURES: ReaderMeasure[] = [640, 720, 820];
const VALID_FONT_FAMILIES: ReaderFontFamily[] = ["system", "sans", "serif"];

function loadPreferences(): StorytellerReaderPreferences {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<StorytellerReaderPreferences> | null;
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }
    return {
      fontSize: VALID_FONT_SIZES.includes(stored.fontSize as ReaderFontSize)
        ? (stored.fontSize as ReaderFontSize)
        : DEFAULT_PREFERENCES.fontSize,
      lineHeight: VALID_LINE_HEIGHTS.includes(
        stored.lineHeight as ReaderLineHeight,
      )
        ? (stored.lineHeight as ReaderLineHeight)
        : DEFAULT_PREFERENCES.lineHeight,
      measure: VALID_MEASURES.includes(stored.measure as ReaderMeasure)
        ? (stored.measure as ReaderMeasure)
        : DEFAULT_PREFERENCES.measure,
      fontFamily: VALID_FONT_FAMILIES.includes(
        stored.fontFamily as ReaderFontFamily,
      )
        ? (stored.fontFamily as ReaderFontFamily)
        : DEFAULT_PREFERENCES.fontFamily,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** 閱讀偏好只屬於本機瀏覽器，不寫入作品資料，也不建立另一套 Reader theme。 */
export function useStorytellerReaderPreferences() {
  const [preferences, setPreferences] =
    useState<StorytellerReaderPreferences>(loadPreferences);

  function updatePreferences(patch: Partial<StorytellerReaderPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { preferences, updatePreferences };
}
