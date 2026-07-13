// SteamLoom 視覺方向的色彩／字體 token，集中在這裡管理，StorytellerLayout 的 MUI theme
// 跟需要對應裝飾色的頁面（例如首頁 Hero）共用同一份數值，不要各自硬編一份。
export interface StorytellerThemeTokens {
  brass: string;
  brassBright: string;
  copper: string;
  patina: string;
  ember: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
}

export const storytellerThemeTokens: Record<
  "light" | "dark",
  StorytellerThemeTokens
> = {
  dark: {
    brass: "#c9974f",
    brassBright: "#e6bd76",
    copper: "#c07539",
    patina: "#5c9482",
    ember: "#e0733a",
    bg: "#16110d",
    surface: "#241b14",
    surfaceRaised: "#2f2419",
    border: "#4a3a28",
    borderStrong: "#6b5638",
    text: "#f0e6d2",
    textMuted: "#b7a688",
  },
  light: {
    brass: "#8a5a1f",
    brassBright: "#a5702a",
    copper: "#93481f",
    patina: "#2f5245",
    ember: "#b1481f",
    bg: "#ede1c8",
    surface: "#e4d6b4",
    surfaceRaised: "#f4ead2",
    border: "#b8a06e",
    borderStrong: "#96814f",
    text: "#241a0f",
    textMuted: "#5c4c34",
  },
};

// 標題／品牌字用的粗襯線（鑄鐵字感），內文維持系統預設 sans 不動——只有標題跟按鈕
// 換字體，避免大量表格／表單文字改成襯線影響密集 UI 的可讀性。
export const storytellerDisplayFontFamily =
  'Rockwell, "Roboto Slab", "Noto Serif TC", Georgia, serif';
// 按鈕／標籤這類「儀表讀數」字用等寬字，一樣是局部套用不是全站預設字體。
export const storytellerMonoFontFamily =
  '"JetBrains Mono", "SF Mono", Consolas, "Noto Sans Mono TC", monospace';
