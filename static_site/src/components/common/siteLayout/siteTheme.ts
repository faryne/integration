import { createTheme, type Theme } from "@mui/material";

/** 使用者選的色彩模式（跟隨系統／淺色／深色）存在 localStorage 的 key */
export const siteColorModeStorageKey = "faryne-color-mode";

/**
 * header／footer 固定的墨色調，跟首頁 LabLayout 同一套，不隨深淺色模式切換。
 */
export const siteInk = {
  bg: "rgba(7, 12, 16, 0.92)",
  panel: "linear-gradient(180deg, rgba(8, 18, 24, 0.98), rgba(4, 8, 13, 0.98))",
  footer: "linear-gradient(180deg, #0c151b, #070c10)",
  line: "rgba(147, 236, 229, 0.18)",
  text: "#d9f8fa",
  textMuted: "#8fa6aa",
  glow: "#72fff0",
  hover: "rgba(114, 255, 240, 0.08)",
} as const;

/** faryne.dev 內頁主題：淺色／深色兩套，由 ThemeProvider + useColorScheme 切換 */
export const siteTheme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#0f766e" },
        background: { default: "#f3f5f5", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#5eead4" },
        background: { default: "#0b1014", paper: "#121a20" },
      },
    },
  },
});

/** 深色模式下頁首橫幅共用的底：淡淡一層青綠，避免各頁淺色漸層在深色底上變成刺眼白塊 */
const darkHeroBackground =
  "linear-gradient(135deg, rgba(94, 234, 212, 0.08) 0%, rgba(18, 26, 32, 0) 60%), #121a20";

/** 頁首橫幅背景：淺色用各頁自己的漸層，深色統一換成 darkHeroBackground（overlay 為疊在上面的光暈，可省略） */
export const heroBackground =
  (light: string, overlay?: string) =>
  ({ palette }: Theme) =>
    palette.mode === "dark"
      ? [overlay, darkHeroBackground].filter(Boolean).join(", ")
      : [overlay, light].filter(Boolean).join(", ");
