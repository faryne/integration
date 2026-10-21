export const interfaceLanguages = ["zh-TW", "zh-CN", "en", "ja", "ko"] as const;

export type InterfaceLanguage = (typeof interfaceLanguages)[number];

// 全站（SteamLoom、galgame.tv…）共用的介面語言偏好。key 沿用 SteamLoom 時期命名，
// 避免既有使用者的選擇被重設；各獨立網域的 localStorage 本來就互相隔離，不會互相干擾。
export const interfaceLanguageStorageKey = "steamloom.interfaceLanguage";

const languageAliases: Record<string, InterfaceLanguage> = {
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

export function normalizeInterfaceLanguage(value?: string | null): InterfaceLanguage | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (languageAliases[normalized]) return languageAliases[normalized];
  if (normalized.startsWith("zh-hant")) return "zh-TW";
  if (normalized.startsWith("zh-hans")) return "zh-CN";
  if (normalized.startsWith("zh")) return normalized.includes("tw") || normalized.includes("hk") || normalized.includes("mo") ? "zh-TW" : "zh-CN";
  return languageAliases[normalized.split("-")[0]];
}

/** 優先使用使用者選擇；首次造訪才依瀏覽器偏好決定，最後回退正體中文。 */
export function getInitialInterfaceLanguage(): InterfaceLanguage {
  if (typeof window === "undefined") return "zh-TW";
  const stored = normalizeInterfaceLanguage(window.localStorage.getItem(interfaceLanguageStorageKey));
  if (stored) return stored;
  for (const language of window.navigator.languages ?? [window.navigator.language]) {
    const resolved = normalizeInterfaceLanguage(language);
    if (resolved) return resolved;
  }
  return "zh-TW";
}

export function persistInterfaceLanguage(language: InterfaceLanguage) {
  window.localStorage.setItem(interfaceLanguageStorageKey, language);
  document.documentElement.lang = language;
}
