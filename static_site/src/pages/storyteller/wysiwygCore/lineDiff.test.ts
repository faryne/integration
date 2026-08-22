import { describe, expect, it } from "vitest";

import { buildCustomLineDiff } from "@/components/common/customDiff";
import {
  extractFootnoteNotesForDiff,
  stripMarkerForDiffContent,
} from "./parser";

function diffStates(left: string, right: string) {
  return buildCustomLineDiff(
    stripMarkerForDiffContent(left),
    stripMarkerForDiffContent(right),
  )
    .filter((line) => line.left !== "" || line.right !== "")
    .map((line) => line.state);
}

describe("stripMarkerForDiffLine / buildCustomLineDiff（非表格情境）", () => {
  it("markerId 改變不應造成 diff", () => {
    const left = "⟦p-aaa⟧一段普通的敘述文字。⟦/p-aaa⟧";
    const right = "⟦p-bbb⟧一段普通的敘述文字。⟦/p-bbb⟧";
    expect(diffStates(left, right)).toEqual(["same"]);
  });

  it("align 屬性改變不應造成本文 diff（文字沒變，只是對齊變了）", () => {
    const left = '⟦p-ccc align="left"⟧置中測試段落。⟦/p-ccc⟧';
    const right = '⟦p-ccc align="center"⟧置中測試段落。⟦/p-ccc⟧';
    expect(diffStates(left, right)).toEqual(["same"]);
  });

  it("文字色／背景色 span marker 改變不應造成本文 diff（只是顏色變了，文字沒變）", () => {
    const left =
      '⟦p-ddd⟧這是⟦span-x1 textColor="red"⟧上色文字⟦/span-x1⟧的段落。⟦/p-ddd⟧';
    const right =
      '⟦p-ddd⟧這是⟦span-x2 textColor="blue" bgColor="yellow"⟧上色文字⟦/span-x2⟧的段落。⟦/p-ddd⟧';
    expect(diffStates(left, right)).toEqual(["same"]);
  });

  it("comment 屬性改變不應造成本文 diff（只是註解內容變了，文字沒變）", () => {
    const left =
      '⟦p-eee⟧一段⟦comment-y1 note="第一版註解"⟧被註解的句子⟦/comment-y1⟧。⟦/p-eee⟧';
    const right =
      '⟦p-eee⟧一段⟦comment-y2 note="第二版註解，內容完全不同"⟧被註解的句子⟦/comment-y2⟧。⟦/p-eee⟧';
    expect(diffStates(left, right)).toEqual(["same"]);
  });

  it("刪除線內容變更應該造成 diff，但 delimiter 本身（--）不應該製造假差異", () => {
    // 兩邊都用 -- 包住文字，內容完全相同時只是 delimiter 位置一樣 → 不該有 diff
    const sameLeft = "⟦p-fff⟧這句話--維持原狀--沒有改變。⟦/p-fff⟧";
    const sameRight = "⟦p-fff⟧這句話--維持原狀--沒有改變。⟦/p-fff⟧";
    expect(diffStates(sameLeft, sameRight)).toEqual(["same"]);

    // 刪除線包住的文字真的變了 → 應該要有 diff
    const changedLeft = "⟦p-ggg⟧這句話--要取消--的任務。⟦/p-ggg⟧";
    const changedRight = "⟦p-ggg⟧這句話--已完成--的任務。⟦/p-ggg⟧";
    expect(diffStates(changedLeft, changedRight)).toEqual(["changed"]);
  });

  it("footnote 錨點文字沒變、只改 note 內容，本文不應該有 diff（note 走獨立的 footnote diff 區塊）", () => {
    const left =
      '⟦p-hhh⟧這裡有個⟦footnote-z1 note="第一版腳注說明"⟧腳注標記詞⟦/footnote-z1⟧。⟦/p-hhh⟧';
    const right =
      '⟦p-hhh⟧這裡有個⟦footnote-z2 note="第二版腳注說明，完全不同的內容"⟧腳注標記詞⟦/footnote-z2⟧。⟦/p-hhh⟧';
    expect(diffStates(left, right)).toEqual(["same"]);
  });

  it("footnote note 內容改變，應該反映在 extractFootnoteNotesForDiff 抽出的獨立 diff 區塊裡", () => {
    const left =
      '⟦p-iii⟧這裡有個⟦footnote-z3 note="舊的補充說明"⟧腳注標記詞⟦/footnote-z3⟧。⟦/p-iii⟧';
    const right =
      '⟦p-iii⟧這裡有個⟦footnote-z3 note="全新的補充說明"⟧腳注標記詞⟦/footnote-z3⟧。⟦/p-iii⟧';

    // 本文 diff：不該看到差異
    expect(diffStates(left, right)).toEqual(["same"]);

    // footnote 專用 diff 區塊：應該要能看到差異
    const leftNotes = extractFootnoteNotesForDiff(left);
    const rightNotes = extractFootnoteNotesForDiff(right);
    expect(leftNotes).toEqual(["舊的補充說明"]);
    expect(rightNotes).toEqual(["全新的補充說明"]);
    const footnoteDiffStates = buildCustomLineDiff(
      leftNotes.join("\n"),
      rightNotes.join("\n"),
    )
      .filter((line) => line.left !== "" || line.right !== "")
      .map((line) => line.state);
    expect(footnoteDiffStates).toEqual(["changed"]);
  });
});
