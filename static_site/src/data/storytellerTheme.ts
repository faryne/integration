import type { Theme } from "@mui/material";

// SteamLoom 視覺方向的色彩／字體 token，集中在這裡管理，StorytellerLayout 的 MUI theme
// 跟需要對應裝飾色的頁面（例如首頁 Hero）共用同一份數值，不要各自硬編一份。
//
// 「換色溫」只動這裡：同一套齒輪／鉚釘機構不變，色盤全部是拿 brass（預設）的
// HSL 做色相旋轉＋中性色降飽和度算出來的，確保彼此的明暗對比關係一致，不是
// 憑感覺挑的色碼。
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

export type StorytellerPaletteName =
  | "brass"
  | "bronze"
  | "malachite"
  | "verdigris"
  | "steel"
  | "cobalt"
  | "violetCopper"
  | "roseCopper"
  | "inkBlack"
  | "silver";

// label 有兩兩一組刻意對照的組合（bronze/malachite 偏綠、cobalt/violetCopper 偏藍紫），
// swatch 照色相排列，方便 SteamPaletteSwitcher 用同一個順序畫成一圈色環。
export const storytellerPaletteMeta: Record<
  StorytellerPaletteName,
  { label: string; swatch: string }
> = {
  brass: { label: "黃銅（預設）", swatch: "#c9974f" },
  bronze: { label: "青銅", swatch: "#a2c94f" },
  malachite: { label: "孔雀石", swatch: "#4fc956" },
  verdigris: { label: "銅綠", swatch: "#4fc9af" },
  steel: { label: "鋼鐵", swatch: "#4f91c9" },
  cobalt: { label: "鈷藍", swatch: "#6a4fc9" },
  violetCopper: { label: "紫銅", swatch: "#c84fc9" },
  roseCopper: { label: "紅銅", swatch: "#c94f5c" },
  inkBlack: { label: "墨黑", swatch: "#938d85" },
  silver: { label: "銀白", swatch: "#838d95" },
};

export const storytellerThemeTokens: Record<
  StorytellerPaletteName,
  Record<"light" | "dark", StorytellerThemeTokens>
> = {
  brass: {
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
  },
  steel: {
    dark: {
      brass: "#4f91c9",
      brassBright: "#76aee6",
      copper: "#3996c0",
      patina: "#906076",
      ember: "#46b6d4",
      bg: "#0f1214",
      surface: "#181d20",
      surfaceRaised: "#1f2529",
      border: "#313b41",
      borderStrong: "#46535d",
      text: "#dae1e8",
      textMuted: "#959faa",
    },
    light: {
      brass: "#1f5d8a",
      brassBright: "#2a6fa5",
      copper: "#1f7993",
      patina: "#4f3241",
      ember: "#2a94a6",
      bg: "#d2dae3",
      surface: "#c1cad7",
      surfaceRaised: "#dbe2eb",
      border: "#8292a4",
      borderStrong: "#637082",
      text: "#151b1e",
      textMuted: "#3f4951",
    },
  },
  verdigris: {
    dark: {
      brass: "#4fc9af",
      brassBright: "#76e6d3",
      copper: "#39c090",
      patina: "#8a6090",
      ember: "#46d493",
      bg: "#0f1412",
      surface: "#18201d",
      surfaceRaised: "#1f2926",
      border: "#31413d",
      borderStrong: "#465d58",
      text: "#dae8e6",
      textMuted: "#95aaa7",
    },
    light: {
      brass: "#1f8a6f",
      brassBright: "#2aa589",
      copper: "#1f935f",
      patina: "#4a324f",
      ember: "#2aa666",
      bg: "#d2e3e1",
      surface: "#c1d7d5",
      surfaceRaised: "#dbebe9",
      border: "#82a4a0",
      borderStrong: "#63827f",
      text: "#151e1c",
      textMuted: "#3f514d",
    },
  },
  roseCopper: {
    dark: {
      brass: "#c94f5c",
      brassBright: "#e6767d",
      copper: "#c0395c",
      patina: "#619060",
      ember: "#d44679",
      bg: "#140f11",
      surface: "#20181a",
      surfaceRaised: "#291f21",
      border: "#413134",
      borderStrong: "#5d4649",
      text: "#e8dadb",
      textMuted: "#aa9596",
    },
    light: {
      brass: "#8a1f2f",
      brassBright: "#a52a3a",
      copper: "#931f47",
      patina: "#344f32",
      ember: "#a62a5e",
      bg: "#e3d2d3",
      surface: "#d7c1c1",
      surfaceRaised: "#ebdbdb",
      border: "#a48283",
      borderStrong: "#826363",
      text: "#1e1516",
      textMuted: "#513f41",
    },
  },
  bronze: {
    dark: {
      brass: "#a2c94f",
      brassBright: "#bde676",
      copper: "#a8c039",
      patina: "#607c90",
      ember: "#c9d446",
      bg: "#13140f",
      surface: "#1e2018",
      surfaceRaised: "#27291f",
      border: "#3d4131",
      borderStrong: "#565d46",
      text: "#e2e8da",
      textMuted: "#a2aa95",
    },
    light: {
      brass: "#6c8a1f",
      brassBright: "#80a52a",
      copper: "#89931f",
      patina: "#32454f",
      ember: "#a4a62a",
      bg: "#dce3d2",
      surface: "#cdd7c1",
      surfaceRaised: "#e4ebdb",
      border: "#96a482",
      borderStrong: "#748263",
      text: "#1c1e15",
      textMuted: "#4b513f",
    },
  },
  malachite: {
    dark: {
      brass: "#4fc956",
      brassBright: "#76e681",
      copper: "#45c039",
      patina: "#676090",
      ember: "#61d446",
      bg: "#10140f",
      surface: "#192018",
      surfaceRaised: "#1f291f",
      border: "#314131",
      borderStrong: "#465d47",
      text: "#dae8dc",
      textMuted: "#95aa97",
    },
    light: {
      brass: "#1f8a21",
      brassBright: "#2aa52e",
      copper: "#34931f",
      patina: "#34324f",
      ember: "#49a62a",
      bg: "#d2e3d5",
      surface: "#c1d7c5",
      surfaceRaised: "#dbebde",
      border: "#82a487",
      borderStrong: "#638268",
      text: "#151e15",
      textMuted: "#3f5140",
    },
  },
  cobalt: {
    dark: {
      brass: "#6a4fc9",
      brassBright: "#9476e6",
      copper: "#4339c0",
      patina: "#906f60",
      ember: "#464ad4",
      bg: "#100f14",
      surface: "#191820",
      surfaceRaised: "#201f29",
      border: "#343141",
      borderStrong: "#4b465d",
      text: "#dedae8",
      textMuted: "#9b95aa",
    },
    light: {
      brass: "#331f8a",
      brassBright: "#432aa5",
      copper: "#1f2193",
      patina: "#4f3932",
      ember: "#2a35a6",
      bg: "#d7d2e3",
      surface: "#c9c1d7",
      surfaceRaised: "#e1dbeb",
      border: "#8d82a4",
      borderStrong: "#6d6382",
      text: "#16151e",
      textMuted: "#433f51",
    },
  },
  violetCopper: {
    dark: {
      brass: "#c84fc9",
      brassBright: "#e676e2",
      copper: "#ab39c0",
      patina: "#8c9060",
      ember: "#af46d4",
      bg: "#130f14",
      surface: "#1e1820",
      surfaceRaised: "#281f29",
      border: "#403141",
      borderStrong: "#5d465d",
      text: "#e8dae7",
      textMuted: "#aa95a9",
    },
    light: {
      brass: "#851f8a",
      brassBright: "#a12aa5",
      copper: "#761f93",
      patina: "#4f4f32",
      ember: "#7e2aa6",
      bg: "#e3d2e2",
      surface: "#d7c1d4",
      surfaceRaised: "#ebdbe9",
      border: "#a482a1",
      borderStrong: "#82637f",
      text: "#1e151e",
      textMuted: "#513f51",
    },
  },
  inkBlack: {
    dark: {
      brass: "#938d85",
      brassBright: "#b5b0a7",
      copper: "#857c74",
      patina: "#757b79",
      ember: "#978a83",
      bg: "#121111",
      surface: "#1c1c1c",
      surfaceRaised: "#252423",
      border: "#3a3938",
      borderStrong: "#535250",
      text: "#e2e1e0",
      textMuted: "#a1a09e",
    },
    light: {
      brass: "#5b554e",
      brassBright: "#6f6960",
      copper: "#605752",
      patina: "#3e4341",
      ember: "#71645f",
      bg: "#dbdbda",
      surface: "#cdcccb",
      surfaceRaised: "#e4e3e2",
      border: "#959491",
      borderStrong: "#747371",
      text: "#1a1a19",
      textMuted: "#494847",
    },
  },
  silver: {
    dark: {
      brass: "#838d95",
      brassBright: "#a6aeb6",
      copper: "#728087",
      patina: "#7c7478",
      ember: "#819499",
      bg: "#111212",
      surface: "#1c1c1c",
      surfaceRaised: "#232425",
      border: "#38393a",
      borderStrong: "#505253",
      text: "#e0e1e2",
      textMuted: "#9e9fa1",
    },
    light: {
      brass: "#4c565d",
      brassBright: "#5e6971",
      copper: "#505e62",
      patina: "#433e41",
      ember: "#5d7073",
      bg: "#d9dadc",
      surface: "#cbcccd",
      surfaceRaised: "#e2e3e4",
      border: "#919395",
      borderStrong: "#707275",
      text: "#191a1a",
      textMuted: "#474849",
    },
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
