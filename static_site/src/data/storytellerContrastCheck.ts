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

/** 對應 CSS `color-mix(in srgb, foreground <percent>%, background)`——sRGB 色版
 * 直接線性內插，跟瀏覽器對這個 CSS function 的實作邏輯一致。`storytellerComponentOverrides.ts`
 * 的 `selectionStateLayer()`／`accentTonalBackground()` 都是拿這個技巧把飽和度較高
 * 的強調色淡化，而不是整塊實色背景——這裡重現同一個公式，才能算出「畫面上實際
 * 疊色完的顏色」，不是只測未疊色前的原始 token。 */
export function compositeColor(
  foreground: string,
  background: string,
  percent: number,
): string {
  const alpha = percent / 100;
  const [fr, fg, fb] = hexToRgb(foreground);
  const [br, bg, bb] = hexToRgb(background);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(fr, br))}${toHex(mix(fg, bg))}${toHex(mix(fb, bb))}`;
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

        // 2. 按鈕：原本 MuiButton contained 直接拿 accentMain 當實色背景，MUI
        //    自動判斷 contrastText（threshold 3，比 WCAG AA 文字要求的 4.5 寬鬆）
        //    常常兩種選擇都不夠格——2026-08-20 改成跟選單 active 同一招的淡色調
        //    （`accentTonalBackground()`，accentMain 用 30% 疊在 surfaceRaised
        //    上）＋固定用 textPrimary 當文字色，這裡驗證的是「畫面上實際疊色完
        //    的樣子」，不是原本的實色背景。
        pushResult(results, {
          ...common,
          category: "button",
          label: "MuiButton containedPrimary：textPrimary / 30% accentMain 疊 surfaceRaised",
          foreground: tokens.textPrimary,
          background: compositeColor(tokens.accentMain, tokens.surfaceRaised, 30),
          required: 4.5,
        });

        // 3. menu active 狀態：原本 MuiMenuItem `.Mui-selected` 直接拿 selection
        //    當實色背景，textPrimary 疊上去常常不夠——2026-08-20 改成
        //    `selectionStateLayer()`，selection 用 22% 疊在 surfaceOverlay 上
        //    （state layer 概念），文字顏色不變。slash 選單選中項目背景、
        //    MuiAutocomplete 選中項目都是同一招同一個 22%，這裡一組檢查涵蓋。
        pushResult(results, {
          ...common,
          category: "menu-active",
          label: "textPrimary / 22% selection 疊 surfaceOverlay",
          foreground: tokens.textPrimary,
          background: compositeColor(tokens.selection, tokens.surfaceOverlay, 22),
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
