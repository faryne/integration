import type { Theme } from "@mui/material";

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

/**
 * 頂部黃銅－銅漸層飾條，套在 position:"relative" 的容器上——跟
 * components/storyteller/SteamPanelAccent.tsx 的 SteamRivets 一起組成
 * 「機殼面板」的視覺語彙，StorytellerShell 的頁首跟 StorytellerProjectCard
 * 共用同一份規則，不要各自刻一份漸層數值。放在這個檔案（不是跟 SteamRivets
 * 放一起）是因為那個檔案只能匯出元件，不然 fast refresh 會失效。
 */
export const steamPanelTopBarSx = {
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    top: 0,
    height: 3,
    borderRadius: "3px 3px 0 0",
    background: (theme: Theme) =>
      `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
};

/** MUI Tabs 的 indicator 換成同一組漸層，跟頁首／卡片的飾條呼應。 */
export const steamTabIndicatorSx = {
  "& .MuiTabs-indicator": {
    height: 3,
    borderRadius: "3px 3px 0 0",
    background: (theme: Theme) =>
      `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
};

/**
 * 閱讀頁內文容器用的左側「書背」飾條——直式漸層，跟頁首／卡片的橫向飾條同一組
 * 顏色，只是方向換成豎的，呼應「翻開一本帳簿」的感覺。
 */
export const steamLedgerEdgeSx = {
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    insetBlock: 0,
    left: 0,
    width: 4,
    borderRadius: "3px 0 0 3px",
    background: (theme: Theme) =>
      `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
};
