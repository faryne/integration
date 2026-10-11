import { createTheme } from "@mui/material/styles";
import { storytellerComponentOverrides } from "./storytellerComponentOverrides";
import {
  storytellerSemanticTokensToCssVariables,
  toStorytellerSemanticTokens,
} from "./storytellerSemanticTheme";
import {
  type StorytellerAppearance,
  storytellerAppearanceMeta,
  storytellerDisplayFontFamily,
  storytellerMonoFontFamily,
  storytellerThemeTokens,
} from "./storytellerTheme";

// SteamLoom 的 MUI theme 與全域樣式，網站（StorytellerLayout）跟 SteamLoom Writer 桌面版共用。
// Writer 透過 Vite alias 直接 import 這支檔案，它那邊的 "@" 指向自己的 src，
// 所以這支（以及它 import 的檔案）只能用相對路徑，不能用 "@/" alias。

export function createStorytellerTheme(appearance: StorytellerAppearance) {
  const tokens = storytellerThemeTokens[appearance];
  const headingStyle = {
    fontFamily: storytellerDisplayFontFamily,
    fontWeight: 700,
  };
  return createTheme({
    // 開 CSS variables 模式：MUI 會把目前的 palette 值同步寫成 `--mui-palette-*`
    // 這種 CSS custom property，掛在 <html> 上。這樣手刻 DOM（不吃 MUI 元件、
    // 不在 React tree 裡用 sx 的那種，例如 slash 選單）也能直接用 var(...) 讀到
    // 當下的顏色，不用把顏色寫死或另外傳遞 theme context 進去——見已知 Bug 記錄
    // 第 7 項，slash 選單原本 background 寫死 #fff，深色模式下不會跟著變。
    cssVariables: true,
    palette: {
      mode: storytellerAppearanceMeta[appearance].mode,
      primary: {
        main: tokens.accent,
        light: tokens.accentBright,
        dark: tokens.support,
      },
      secondary: { main: tokens.accentSecondary },
      background: { default: tokens.bg, paper: tokens.surface },
      text: { primary: tokens.text, secondary: tokens.textMuted },
      divider: tokens.border,
    },
    shape: { borderRadius: 2 },
    typography: {
      fontFamily: storytellerMonoFontFamily,
      h1: headingStyle,
      h2: headingStyle,
      h3: headingStyle,
      h4: headingStyle,
      h5: headingStyle,
      h6: headingStyle,
      button: {
        fontFamily: storytellerMonoFontFamily,
        fontWeight: 700,
        textTransform: "none",
        letterSpacing: "0.02em",
      },
    },
    components: storytellerComponentOverrides(),
  });
}

// 給 <GlobalStyles styles={...}>：semantic CSS variables（editor 內不在 MUI tree 裡的原生選單會用到）＋頁面底色。
export function storytellerGlobalStyles(appearance: StorytellerAppearance) {
  return {
    ":root": storytellerSemanticTokensToCssVariables(
      toStorytellerSemanticTokens(storytellerThemeTokens[appearance]),
    ),
    body: {
      backgroundColor: "var(--storyteller-surface-base)",
      backgroundImage:
        "radial-gradient(circle at 8% 18%, color-mix(in srgb, var(--storyteller-accent-main) 10%, transparent), transparent 30rem)",
    },
  };
}
