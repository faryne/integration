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

  it("已知未達標項目（按鈕 contrastText／選單 active／少數色系 focus ring）數量沒有增加", () => {
    // 2026-08-19 對比度檢查跑出來的已知落差，root cause 記錄在
    // 視覺主題(createTheme)規劃.md 的 Phase E 段落：
    // - MuiButton contained 的 contrastText 是 MUI 自動判斷（threshold 3），
    //   比 WCAG AA 文字要求的 4.5 寬鬆——accentMain 這種中亮度品牌色常常黑字
    //   白字兩種選擇都不夠格。
    // - 選單 active 背景（selection token）同樣是中亮度強調色，全彩 textPrimary
    //   疊上去對比常常不夠。
    // - 少數色系（brass／verdigris／bronze／malachite）淺色模式的 focusRing
    //   沿用 accentHover，跟淺色 surface 對比不到 3:1。
    // 這三類要修需要重新設計 11 色系的按鈕/選單配色（不是調一兩個數字就好，
    // 會實際改變每個色系的按鈕/選單觀感），是一次視覺設計決策、不是單純 bug
    // fix，故意先不動——這裡卡住已知失敗數量，之後任何「新增」的失敗（不管是
    // 這三類裡新增，還是別的類別出現失敗）都會讓這個測試立刻紅燈，不會被
    // 悄悄蓋過去；等哪天決定好新配色方案，把這幾個 token 修完後，這個數字要
    // 跟著往下修，不是繼續放寬。
    const KNOWN_FAILURE_COUNT = 75;
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
