import { useSyncExternalStore } from "react";

export type TypographyFontSize = 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;
export type TypographyLineHeight = 1.7 | 1.95 | 2.2;
export type TypographyMeasure = 640 | 720 | 820;
export type TypographyFontFamily = "system" | "sans" | "serif";

export const TYPOGRAPHY_FONT_SIZES: TypographyFontSize[] = [
  15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
];
export const TYPOGRAPHY_LINE_HEIGHTS: TypographyLineHeight[] = [1.7, 1.95, 2.2];
export const TYPOGRAPHY_MEASURES: TypographyMeasure[] = [640, 720, 820];
export const TYPOGRAPHY_FONT_FAMILY_KEYS: TypographyFontFamily[] = [
  "system",
  "sans",
  "serif",
];

export const TYPOGRAPHY_FONT_FAMILIES: Record<TypographyFontFamily, string> = {
  system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  sans: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  serif: '"Noto Serif TC", "Songti TC", PMingLiU, serif',
};

export interface StorytellerTypographyPreferences {
  fontSize: TypographyFontSize;
  lineHeight: TypographyLineHeight;
  /** 頁面寬度只有閱讀頁用得到；編輯區寬度由工作台版面決定，存著但不套用。 */
  measure: TypographyMeasure;
  fontFamily: TypographyFontFamily;
}

type PreferencesPatch = Partial<StorytellerTypographyPreferences>;

/** 逐欄驗證，不合法（舊版資料、手改 localStorage）的欄位退回預設值。 */
function pick<T>(value: unknown, valid: T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}

/**
 * 每個 storage key 一個模組層 store：同一頁有多個編輯器實例（工作台多分頁、圖像描述對話框）
 * 時，改一處其他處透過 useSyncExternalStore 同步，不用等重新掛載。
 */
function createPreferencesStore(
  storageKey: string,
  defaults: StorytellerTypographyPreferences,
) {
  let current: StorytellerTypographyPreferences | null = null;
  const listeners = new Set<() => void>();

  function load(): StorytellerTypographyPreferences {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "null",
      ) as PreferencesPatch | null;
      if (!stored) return defaults;
      return {
        fontSize: pick(stored.fontSize, TYPOGRAPHY_FONT_SIZES, defaults.fontSize),
        lineHeight: pick(
          stored.lineHeight,
          TYPOGRAPHY_LINE_HEIGHTS,
          defaults.lineHeight,
        ),
        measure: pick(stored.measure, TYPOGRAPHY_MEASURES, defaults.measure),
        fontFamily: pick(
          stored.fontFamily,
          TYPOGRAPHY_FONT_FAMILY_KEYS,
          defaults.fontFamily,
        ),
      };
    } catch {
      return defaults;
    }
  }

  const getSnapshot = () => (current ??= load());

  function update(patch: PreferencesPatch) {
    current = { ...getSnapshot(), ...patch };
    // 無痕模式／封鎖網站資料時寫入會丟例外：這一頁內仍然生效，只是不會被記住
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(current));
    } catch {
      /* 忽略 */
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return function usePreferences() {
    const preferences = useSyncExternalStore(subscribe, getSnapshot);
    return { preferences, updatePreferences: update };
  };
}

/** 閱讀偏好只屬於本機瀏覽器，不寫入作品資料，也不建立另一套 Reader theme。 */
export const useStorytellerReaderPreferences = createPreferencesStore(
  "storyteller-reader-preferences",
  { fontSize: 18, lineHeight: 1.95, measure: 720, fontFamily: "system" },
);

/** 編輯區偏好跟閱讀頁分開存；故事、設定集、圖像描述共用同一份。預設貼近原本整站字體 16px 黑體。 */
export const useStorytellerEditorPreferences = createPreferencesStore(
  "storyteller-editor-preferences",
  { fontSize: 16, lineHeight: 1.7, measure: 720, fontFamily: "sans" },
);
