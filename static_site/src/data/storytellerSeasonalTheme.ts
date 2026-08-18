import type { StorytellerSemanticTokens } from "./storytellerSemanticTheme";

/**
 * Phase D（視覺主題規劃）：節慶活動 overlay 機制。
 *
 * 刻意不做成第 12、13...組獨立色系——會跟現有 11 色系 × light/dark 的組合數
 * 繼續爆炸相乘，維護成本太高。改成疊加層：`base`（Phase A 的 semantic
 * token）+ `overlayTokens`（只覆寫其中幾個 key），`season: "none"` 時
 * overlayTokens 是空物件，完全不影響現有畫面。
 *
 * 只允許覆寫少數跟「裝飾／強調色」有關的 key（accentMain／accentHover／
 * focusRing／selection／borderStrong），刻意不開放覆寫 surfaceBase／
 * textPrimary／textMuted 這類核心可讀性 token，也不去動 danger（MUI
 * severity 色系是元件層自己決定，不歸這層管）——節慶只是「故事頁穿上節慶
 * 外衣」，不能讓核心文字對比度或危險操作的顏色語意跟著節慶變動。
 */
export type StorytellerSeasonalOverlayTokens = Partial<
  Pick<
    StorytellerSemanticTokens,
    "accentMain" | "accentHover" | "focusRing" | "selection" | "borderStrong"
  >
>;

export interface StorytellerSeasonalTheme {
  id: string;
  label: string;
  /** 之後要做「依日期自動建議套用」（Phase D 觸發機制第 3 層，這次不做）時
   * 用，第一版留空即可，不影響手動開關的行為。 */
  activeWindow?: { startMonthDay: string; endMonthDay: string };
  overlayTokens: StorytellerSeasonalOverlayTokens;
  /** 裝飾性 asset（例如角落小圖案）路徑，第一版先留空，機制驗證過沒問題
   * 之後要加裝飾只是加資料，不用再動架構。 */
  decorations?: { cornerAsset?: string };
  /** 是否允許被「依日期自動建議套用」的機制選中，第一版沒有做那個機制，
   * 這個欄位先存在，值先不影響任何行為。 */
  canAutoActivate: boolean;
}

export type StorytellerSeasonId = "none" | "midAutumn";

export const storytellerSeasonalThemes: Record<
  StorytellerSeasonId,
  StorytellerSeasonalTheme
> = {
  none: {
    id: "none",
    label: "無節慶主題",
    overlayTokens: {},
    canAutoActivate: false,
  },
  // 示範節慶（Phase D 第一版）：中秋節。月光金＋暖琥珀邊框，只換強調色/選取色
  // /focus 外框/強調邊框這幾個裝飾性 token，故事頁核心排版跟文字對比度完全
  // 不變。色碼比預設 brass（#c9974f）更亮、更黃，跟月亮的聯想更直接。
  midAutumn: {
    id: "midAutumn",
    label: "中秋節",
    overlayTokens: {
      accentMain: "#e6b143",
      accentHover: "#f5cc6e",
      focusRing: "#f5cc6e",
      selection: "#f0c26a",
      borderStrong: "#8a6a3a",
    },
    canAutoActivate: true,
  },
};

/** `base + seasonal overlay` 的 merge 邏輯：`overlayTokens` 有值的 key 蓋掉
 * base 對應的值，沒覆寫的 key 維持 base 原值。`season: "none"` 時
 * `overlayTokens` 是空物件，回傳的物件在數值上等於 base 本身。 */
export function mergeStorytellerSeasonalTokens(
  base: StorytellerSemanticTokens,
  seasonId: StorytellerSeasonId,
): StorytellerSemanticTokens {
  return { ...base, ...storytellerSeasonalThemes[seasonId].overlayTokens };
}
