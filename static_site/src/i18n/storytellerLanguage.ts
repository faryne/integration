export const storytellerLanguages = ["zh-TW", "zh-CN", "en", "ja", "ko"] as const;

export type StorytellerLanguage = (typeof storytellerLanguages)[number];

export const storytellerLanguageStorageKey = "steamloom.interfaceLanguage";

const languageAliases: Record<string, StorytellerLanguage> = {
  "zh-tw": "zh-TW",
  "zh-hant": "zh-TW",
  "zh-hant-tw": "zh-TW",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  "zh-hans-cn": "zh-CN",
  en: "en",
  ja: "ja",
  ko: "ko",
};

export function normalizeStorytellerLanguage(value?: string | null): StorytellerLanguage | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (languageAliases[normalized]) return languageAliases[normalized];
  if (normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("zh-hans")) return "zh-CN";
  if (normalized.startsWith("zh")) return normalized.includes("tw") || normalized.includes("hk") || normalized.includes("mo") ? "zh-TW" : "zh-CN";
  return languageAliases[normalized.split("-")[0]];
}

/** 優先使用使用者選擇；首次造訪才依瀏覽器偏好決定，最後回退正體中文。 */
export function getInitialStorytellerLanguage(): StorytellerLanguage {
  if (typeof window === "undefined") return "zh-TW";
  const stored = normalizeStorytellerLanguage(window.localStorage.getItem(storytellerLanguageStorageKey));
  if (stored) return stored;
  for (const language of window.navigator.languages ?? [window.navigator.language]) {
    const resolved = normalizeStorytellerLanguage(language);
    if (resolved) return resolved;
  }
  return "zh-TW";
}

export function persistStorytellerLanguage(language: StorytellerLanguage) {
  window.localStorage.setItem(storytellerLanguageStorageKey, language);
  document.documentElement.lang = language;
}
