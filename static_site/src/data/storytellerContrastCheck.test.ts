import { describe, expect, it } from "vitest";
import { checkStorytellerContrast } from "./storytellerContrastCheck";

/**
 * Phase E（視覺主題規劃）對比度檢查——跑過 11 色系 × light/dark ×（none／
 * 中秋節）＝44 組 semantic token 組合，每組檢查文字/背景、按鈕、menu active
 * 狀態、focus ring 四類是否達 WCAG AA。
 */
describe("storyteller 對比度檢查（Phase E）", () => {
  const results = checkStorytellerContrast();

  it("文字/背景（textPrimary／textMuted 對三種 surface）在全部組合皆過 WCAG AA", () => {
    // 這是使用者「讀故事」「看選單項目文字」時最頻繁碰到的組合，也是唯一目前
    // 全部組合都過關的類別——特別獨立一個測試盯住，之後不管怎麼調色系都不能
    // 讓這類回歸（跟按鈕/選單 active 不一樣，這類沒有已知例外，一筆都不能有）。
    const failures = results.filter((r) => r.category === "text" && !r.pass);
    if (failures.length > 0) {
      console.table(failures);
    }
    expect(failures).toEqual([]);
  });

  it("已知未達標項目（少數色系 focus ring）數量沒有增加", () => {
    // 2026-08-19 對比度檢查原本跑出 75 筆已知落差（按鈕 contrastText／選單
    // active／少數色系 focus ring 三類）。按鈕跟選單 active 已在 2026-08-20
    // 修掉——兩者都是「整塊實色強調色背景 + 全對比度文字」這個用法本身有問題
    // （accentMain／selection 是中亮度品牌色，跟純黑/純白都很難同時達到 4.5:1，
    // 色彩學硬限制），改成 `storytellerComponentOverrides.ts` 的
    // `accentTonalBackground()`／`selectionStateLayer()`：不整塊實色填滿，改用
    // `color-mix()` 疊一層淡色調在原本背景上，文字固定用已證實「全部色系都過
    // 4.5:1」的 textPrimary，不用強調色本身當文字——不用重新設計 11 色系的
    // token 數值，兩個類別全數轉綠。
    //
    // 剩下少數色系（brass／verdigris／bronze／malachite）淺色模式的 focusRing
    // 沿用 accentHover，跟淺色 surface 對比不到 3:1，這個還沒修，跟按鈕/選單
    // active 是不同性質的問題（focusRing 是單一 token 數值需要重新選色，不是
    // 用法問題），故意留到之後再處理，這裡卡住已知失敗數量防止繼續惡化。
    const KNOWN_FAILURE_COUNT = 10;
    const failures = results.filter((r) => r.category !== "text" && !r.pass);
    if (failures.length !== KNOWN_FAILURE_COUNT) {
      console.table(
        failures.map((f) => ({
          palette: f.paletteLabel,
          mode: f.mode,
          season: f.season,
          category: f.category,
          label: f.label,
          ratio: f.ratio.toFixed(2),
          required: f.required,
        })),
      );
    }
    expect(failures.length).toBe(KNOWN_FAILURE_COUNT);
  });
});
