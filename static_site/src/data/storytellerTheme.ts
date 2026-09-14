import type { Theme } from "@mui/material";

export interface StorytellerThemeTokens {
  accent: string;
  accentBright: string;
  accentSecondary: string;
  support: string;
  danger: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
}

export type StorytellerAppearance = "nocturne" | "ivory" | "prism";

export interface StorytellerAppearanceMeta {
  label: string;
  description: string;
  swatch: string;
  mode: "light" | "dark";
}

export const storytellerAppearanceOrder: StorytellerAppearance[] = [
  "nocturne",
  "ivory",
  "prism",
];

/** 三種 appearance 都是完整外觀，不再另外疊加 palette 與 light/dark。 */
export const storytellerAppearanceMeta: Record<
  StorytellerAppearance,
  StorytellerAppearanceMeta
> = {
  nocturne: {
    label: "夜織",
    description: "深色工房與冷色光絲，預設外觀",
    swatch: "#7aa8ff",
    mode: "dark",
  },
  ivory: {
    label: "紙本",
    description: "暖灰紙面與深墨色，適合日間閱讀",
    swatch: "#e8e0d2",
    mode: "light",
  },
  prism: {
    label: "稜光",
    description: "暗紫底色與青粉雙色光澤",
    swatch: "#55d9d0",
    mode: "dark",
  },
};

export const storytellerThemeTokens: Record<
  StorytellerAppearance,
  StorytellerThemeTokens
> = {
  nocturne: {
    accent: "#7aa8ff",
    accentBright: "#b8ceff",
    accentSecondary: "#be8fff",
    support: "#62d4c9",
    danger: "#ff746c",
    bg: "#090c13",
    surface: "#111724",
    surfaceRaised: "#182133",
    border: "#2d3850",
    borderStrong: "#596b90",
    text: "#eef2ff",
    textMuted: "#aeb8cf",
  },
  ivory: {
    accent: "#315f9e",
    accentBright: "#1f4d86",
    accentSecondary: "#76509f",
    support: "#2f756c",
    danger: "#a83632",
    bg: "#e8e0d2",
    surface: "#f1eadf",
    surfaceRaised: "#fbf6ee",
    border: "#c4b7a5",
    borderStrong: "#817462",
    text: "#251f1a",
    textMuted: "#665d54",
  },
  prism: {
    accent: "#55d9d0",
    accentBright: "#9ff4ed",
    accentSecondary: "#f08bd8",
    support: "#79d4b5",
    danger: "#ff718c",
    bg: "#100b18",
    surface: "#1a1127",
    surfaceRaised: "#281a37",
    border: "#402e52",
    borderStrong: "#806294",
    text: "#f4f0ff",
    textMuted: "#bbb1cc",
  },
};

// 標題使用帶有人文感的襯線字；操作元件維持 sans，長文與密集資料不會被裝飾字干擾。
export const storytellerDisplayFontFamily =
  '"Noto Serif TC", "Songti TC", "PMingLiU", Georgia, serif';
export const storytellerMonoFontFamily =
  '"Noto Sans TC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** 細光絲取代原本厚重的黃銅機殼飾條，共用卡片與頁首都使用同一規則。 */
export const steamPanelTopBarSx = {
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    top: 0,
    height: "1px",
    background: (theme: Theme) =>
      `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, transparent)`,
  },
};

/** Tabs indicator 沿用光絲漸層，不再使用粗金屬飾條。 */
export const steamTabIndicatorSx = {
  "& .MuiTabs-indicator": {
    height: "2px",
    background: (theme: Theme) =>
      `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
};

/** 閱讀紙面的細書背，只負責建立層次，不與內容搶焦點。 */
export const steamLedgerEdgeSx = {
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    insetBlock: 0,
    left: 0,
    width: 2,
    background: (theme: Theme) =>
      `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
};
