import type { StorytellerThemeTokens } from "./storytellerTheme";

/**
 * Phase A（視覺主題規劃）：semantic token 層。`storytellerTheme.ts` 的 raw token
 * （`brass`／`copper`／`patina` 這種色系專屬名稱）只有 `StorytellerLayout.tsx` 的
 * `createTheme()` 在用，元件層（Phase B 的 component override、Phase C 的手刻
 * DOM）不該直接認得「現在是不是 brass 色系」——用這一層語意化名稱隔開，色系本身
 * 增減／換算法都不會影響到 component override 要吃哪個欄位。
 *
 * 之後 Phase D 的節慶 overlay 也是疊在這層上面（只覆寫其中幾個 key），不是疊在
 * raw token 上，理由一樣：overlay 不需要知道底下是哪個色系。
 */
export interface StorytellerSemanticTokens {
  /** 頁面最底層背景（對應 MUI `background.default`）。 */
  surfaceBase: string;
  /** 一般卡片／Paper 層級（對應 MUI `background.paper`）。 */
  surfaceRaised: string;
  /** 浮在 surfaceRaised 之上的層級——Dialog、Popover、Menu 這類疊加在一般卡片
   * 上面的元件用這個，跟 surfaceRaised 要有清楚的層次差異，不能一樣。 */
  surfaceOverlay: string;
  /** 一般分隔線／邊框。 */
  borderSubtle: string;
  /** 需要強調的邊框（例如選取中的圖片、focus 狀態的外框）。 */
  borderStrong: string;
  textPrimary: string;
  textMuted: string;
  /** 主要互動色（連結、按鈕、啟用狀態）。 */
  accentMain: string;
  /** accentMain 的 hover/active 變體。 */
  accentHover: string;
  /** 鍵盤 focus 外框顏色——Phase E 的 a11y 要求不能被拿掉，只能換色，所以獨立
   * 一個 key，不要跟 accentHover 共用（未來想單獨調整 focus 可視度不會互相牽動）。 */
  focusRing: string;
  /** 錯誤／危險操作用色（例如刪除按鈕），跟色系的暖色調子系統一，不是憑空另配一個紅色。 */
  danger: string;
  /** 選取狀態的背景色（例如選單 active 項目、文字選取範圍）。 */
  selection: string;
  /** 編輯器本文紙面底色。目前跟 surfaceRaised 同值，獨立成一個 key 是為了讓
   * 「編輯器紙面」跟「一般 MUI Paper」未來可以各自調整，不用共用同一個決定。 */
  editorPaper: string;
  /** slash／bubble／context／table menu 這類手刻選單的背景色。目前跟
   * surfaceOverlay 同值，理由跟 editorPaper 一樣：先給獨立 key，之後好調。 */
  editorMenu: string;
}

export function toStorytellerSemanticTokens(
  raw: StorytellerThemeTokens,
): StorytellerSemanticTokens {
  return {
    surfaceBase: raw.bg,
    surfaceRaised: raw.surface,
    surfaceOverlay: raw.surfaceRaised,
    borderSubtle: raw.border,
    borderStrong: raw.borderStrong,
    textPrimary: raw.text,
    textMuted: raw.textMuted,
    accentMain: raw.brass,
    accentHover: raw.brassBright,
    focusRing: raw.brassBright,
    danger: raw.ember,
    selection: raw.brassBright,
    editorPaper: raw.surface,
    editorMenu: raw.surfaceRaised,
  };
}

/** semantic token 的 key 對應到要曝露的 CSS custom property 名稱（kebab-case，
 * `--storyteller-` 前綴跟 MUI 自己的 `--mui-palette-*` 分開，不會撞名）。手刻 DOM
 * 元件（例如 slashCommandExtension.tsx）直接用 `var(--storyteller-surface-overlay)`
 * 這樣的語法讀取，不用另外傳 theme context 進去——這些變數是 `StorytellerLayout.tsx`
 * 用 `GlobalStyles` 掛在 `:root` 上的，見那邊的說明。 */
export const STORYTELLER_CSS_VARIABLE_NAMES: Record<
  keyof StorytellerSemanticTokens,
  string
> = {
  surfaceBase: "--storyteller-surface-base",
  surfaceRaised: "--storyteller-surface-raised",
  surfaceOverlay: "--storyteller-surface-overlay",
  borderSubtle: "--storyteller-border-subtle",
  borderStrong: "--storyteller-border-strong",
  textPrimary: "--storyteller-text-primary",
  textMuted: "--storyteller-text-muted",
  accentMain: "--storyteller-accent-main",
  accentHover: "--storyteller-accent-hover",
  focusRing: "--storyteller-focus-ring",
  danger: "--storyteller-danger",
  selection: "--storyteller-selection",
  editorPaper: "--storyteller-editor-paper",
  editorMenu: "--storyteller-editor-menu",
};

export function storytellerSemanticTokensToCssVariables(
  tokens: StorytellerSemanticTokens,
): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(tokens) as (keyof StorytellerSemanticTokens)[]).map((key) => [
      STORYTELLER_CSS_VARIABLE_NAMES[key],
      tokens[key],
    ]),
  );
}
