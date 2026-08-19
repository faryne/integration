import {
  storytellerPaletteMeta,
  storytellerThemeTokens,
  type StorytellerPaletteName,
} from "./storytellerTheme";
import { toStorytellerSemanticTokens } from "./storytellerSemanticTheme";
import {
  mergeStorytellerSeasonalTokens,
  storytellerSeasonalThemes,
  type StorytellerSeasonId,
} from "./storytellerSeasonalTheme";

/**
 * Phase E（視覺主題規劃）：對比度檢查 script。純函式 + 資料，不用瀏覽器/DOM，
 * 讓 `npx vitest run` 能直接算過全部色系組合，不用肉眼一個個切換色系比對。
 *
 * WCAG 2 相對亮度／對比度公式（sRGB，無 gamma 校正以外的近似）：
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * MUI `createPalette` 在沒有明講 `contrastText` 時的自動決定邏輯（`getContrastText`）：
 * 用 `getContrastRatio(background, '#fff')` 是否 >= `contrastThreshold`（預設 3）
 * 決定要用深色字（`rgba(0, 0, 0, 0.87)`）還是白字（`#fff`）。MUI 的 `getContrastRatio`
 * 只吃 RGB 通道算亮度，會忽略 alpha（也就是說 MUI 自己的判斷邏輯把
 * `rgba(0,0,0,0.87)` 當成純黑 `#000000` 處理，這是 MUI 本身已知的簡化，不是這裡
 * 的近似誤差）——這裡刻意原樣重現這個邏輯，才能算出「MUI 實際上會選哪個顏色」。
 */
const MUI_CONTRAST_THRESHOLD = 3;

export function muiAutoContrastText(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#ffffff") >= MUI_CONTRAST_THRESHOLD
    ? "#000000"
    : "#ffffff";
}

export type ContrastCategory = "text" | "button" | "menu-active" | "focus-ring";

export interface ContrastCheckResult {
  palette: StorytellerPaletteName;
  paletteLabel: string;
  mode: "light" | "dark";
  season: StorytellerSeasonId;
  category: ContrastCategory;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  /** WCAG AA：一般文字 4.5:1；「非文字」UI 元件（focus ring 這類）3:1（SC 1.4.11）。 */
  required: number;
  pass: boolean;
}

function pushResult(
  results: ContrastCheckResult[],
  base: Omit<ContrastCheckResult, "ratio" | "pass">,
): void {
  const ratio = contrastRatio(base.foreground, base.background);
  results.push({ ...base, ratio, pass: ratio >= base.required });
}

const PALETTES = Object.keys(storytellerThemeTokens) as StorytellerPaletteName[];
const MODES = ["light", "dark"] as const;
/** 目前唯一實作的節慶主題是中秋節（見 storytellerSeasonalTheme.ts），跟 "none"
 * 一起跑——節慶 overlay 只覆寫強調色/選取色/focus ring/邊框，理論上不會影響
 * 文字/背景這類核心可讀性 token，但還是實際算過確認，不假設。 */
const SEASONS = Object.keys(storytellerSeasonalThemes) as StorytellerSeasonId[];

export function checkStorytellerContrast(): ContrastCheckResult[] {
  const results: ContrastCheckResult[] = [];

  for (const palette of PALETTES) {
    for (const mode of MODES) {
      const raw = storytellerThemeTokens[palette][mode];
      const base = toStorytellerSemanticTokens(raw);

      for (const season of SEASONS) {
        const tokens = mergeStorytellerSeasonalTokens(base, season, mode);
        const common = {
          palette,
          paletteLabel: storytellerPaletteMeta[palette].label,
          mode,
          season,
        };

        // 1. 文字/背景：內文字色在三種 surface 層級上，加上次要文字色（textMuted）
        //    在最常見的兩種 surface 上——這幾組是使用者實際「讀故事」「看選單項目」
        //    時最頻繁碰到的組合。
        pushResult(results, {
          ...common,
          category: "text",
          label: "textPrimary / surfaceBase",
          foreground: tokens.textPrimary,
          background: tokens.surfaceBase,
          required: 4.5,
        });
        pushResult(results, {
          ...common,
          category: "text",
          label: "textPrimary / surfaceRaised",
          foreground: tokens.textPrimary,
          background: tokens.surfaceRaised,
          required: 4.5,
        });
        pushResult(results, {
          ...common,
          category: "text",
          label: "textPrimary / surfaceOverlay（Dialog／Menu／Tooltip 文字）",
          foreground: tokens.textPrimary,
          background: tokens.surfaceOverlay,
          required: 4.5,
        });
        pushResult(results, {
          ...common,
          category: "text",
          label: "textMuted / surfaceBase",
          foreground: tokens.textMuted,
          background: tokens.surfaceBase,
          required: 4.5,
        });
        pushResult(results, {
          ...common,
          category: "text",
          label: "textMuted / surfaceOverlay",
          foreground: tokens.textMuted,
          background: tokens.surfaceOverlay,
          required: 4.5,
        });

        // 2. 按鈕：MUI `createTheme` 沒有明講 `primary.contrastText`，是自動算的
        //    （見 muiAutoContrastText 說明）——實際檢查 MUI 選出來的字色在
        //    accentMain 背景上是否真的達到 AA，而不是只信任 MUI 的內部判斷
        //    （MUI 的判斷用 threshold 3，比 WCAG AA 文字要求的 4.5 寬鬆）。
        pushResult(results, {
          ...common,
          category: "button",
          label: "MuiButton contained：contrastText / accentMain",
          foreground: muiAutoContrastText(tokens.accentMain),
          background: tokens.accentMain,
          required: 4.5,
        });

        // 3. menu active 狀態：MuiMenuItem `.Mui-selected` 只換背景色（見
        //    storytellerComponentOverrides.ts），文字顏色沒有另外覆寫、維持
        //    textPrimary——slash 選單選中項目的高亮背景也是同一個 selection
        //    token（見 slashCommandExtension.tsx），同一組檢查涵蓋兩邊。
        pushResult(results, {
          ...common,
          category: "menu-active",
          label: "textPrimary / selection（選單 active 背景）",
          foreground: tokens.textPrimary,
          background: tokens.selection,
          required: 4.5,
        });

        // 4. focus ring：非文字 UI 元件的對比度要求是 WCAG 2.1 SC 1.4.11，
        //    3:1（不是文字的 4.5:1），對象是 focus ring 會出現的幾種背景。
        pushResult(results, {
          ...common,
          category: "focus-ring",
          label: "focusRing / surfaceBase",
          foreground: tokens.focusRing,
          background: tokens.surfaceBase,
          required: 3,
        });
        pushResult(results, {
          ...common,
          category: "focus-ring",
          label: "focusRing / surfaceRaised",
          foreground: tokens.focusRing,
          background: tokens.surfaceRaised,
          required: 3,
        });
        pushResult(results, {
          ...common,
          category: "focus-ring",
          label: "focusRing / surfaceOverlay",
          foreground: tokens.focusRing,
          background: tokens.surfaceOverlay,
          required: 3,
        });
      }
    }
  }

  return results;
}
