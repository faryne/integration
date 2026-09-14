import { describe, expect, it } from "vitest";
import { checkStorytellerContrast } from "./storytellerContrastCheck";

/** 三種完整 appearance × 節慶 overlay，逐組驗證常用文字與互動狀態。 */
describe("storyteller appearance 對比度檢查", () => {
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

  it("按鈕、選單 active 與 focus ring 在全部組合皆達標", () => {
    const failures = results.filter((r) => r.category !== "text" && !r.pass);
    if (failures.length > 0) {
      console.table(
        failures.map((f) => ({
          appearance: f.appearanceLabel,
          mode: f.mode,
          category: f.category,
          label: f.label,
          ratio: f.ratio.toFixed(2),
          required: f.required,
        })),
      );
    }
    expect(failures).toEqual([]);
  });
});
