import { createTheme } from "@mui/material";

// joyu.fyi 自己的配色：跟圖示同一組深紫＋粉紅，不再沿用 faryne.dev 的墨色＋青綠（刻意跟主站切割）

/** 色彩模式（跟隨系統／淺色／深色）存在 localStorage 的 key，跟主站分開 */
export const joyuColorModeStorageKey = "joyu-color-mode";

/** 頁首、頁尾、首頁主視覺固定的深紫色調，不隨深淺色模式切換 */
export const joyuInk = {
  bg: "#2b1d2e",
  deep: "#1c1420",
  line: "#4a3550",
  text: "#f3e6ef",
  textMuted: "#b39fb0",
  accent: "#ff5c8a",
  hero: "linear-gradient(135deg, #2b1d2e, #4a2840)",
} as const;

export const joyuTheme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        // 白底上的粉紅要深一點才有足夠對比
        primary: { main: "#d63a6c" },
        background: { default: "#faf7f9", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#ff5c8a" },
        background: { default: "#17111a", paper: "#221a25" },
      },
    },
  },
});
