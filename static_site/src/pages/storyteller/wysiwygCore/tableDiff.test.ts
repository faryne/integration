import { describe, expect, it } from "vitest";

import { buildCustomLineDiff } from "@/components/common/customDiff";
import { stripMarkerForDiffContent } from "./parser";

function diffTableLines(left: string, right: string) {
  return buildCustomLineDiff(
    stripMarkerForDiffContent(left),
    stripMarkerForDiffContent(right),
  )
    .filter((line) => line.left !== "" || line.right !== "")
    .map(({ leftIndex, rightIndex, left, right, state }) => ({
      leftIndex,
      rightIndex,
      left,
      right,
      state,
    }));
}

describe("table marker diff", () => {
  it("改某一列 cell 內容時，只讓該列進入 diff", () => {
    const left = [
      '⟦table tableId="tbl_1" rowId="row_1"⟧| 角色 | 狀態 |⟦/table⟧',
      '⟦table tableId="tbl_1" rowId="row_2"⟧| 莉亞 | **完成** |⟦/table⟧',
      '⟦table tableId="tbl_1" rowId="row_3"⟧| 米菈 | 待命 |⟦/table⟧',
    ].join("\n");
    const right = [
      '⟦table tableId="tbl_1" rowId="row_1"⟧| 角色 | 狀態 |⟦/table⟧',
      '⟦table tableId="tbl_1" rowId="row_2"⟧| 莉亞 | --取消-- |⟦/table⟧',
      '⟦table tableId="tbl_1" rowId="row_3"⟧| 米菈 | 待命 |⟦/table⟧',
    ].join("\n");

    expect(diffTableLines(left, right)).toEqual([
      {
        leftIndex: 1,
        rightIndex: 1,
        left: "| 角色 | 狀態 |",
        right: "| 角色 | 狀態 |",
        state: "same",
      },
      {
        leftIndex: 2,
        rightIndex: 2,
        left: "| 莉亞 | 完成 |",
        right: "| 莉亞 | 取消 |",
        state: "changed",
      },
      {
        leftIndex: 3,
        rightIndex: 3,
        left: "| 米菈 | 待命 |",
        right: "| 米菈 | 待命 |",
        state: "same",
      },
    ]);
  });

  it("tableId／rowId 改變但 cell 文字相同時，不造成內容 diff", () => {
    const left = [
      '⟦table tableId="tbl_a" rowId="row_a1"⟧| 角色 | 任務 |⟦/table⟧',
      '⟦table tableId="tbl_a" rowId="row_a2"⟧| 莉亞 | 偵查 |⟦/table⟧',
    ].join("\n");
    const right = [
      '⟦table tableId="tbl_b" rowId="row_b1"⟧| 角色 | 任務 |⟦/table⟧',
      '⟦table tableId="tbl_b" rowId="row_b2"⟧| 莉亞 | 偵查 |⟦/table⟧',
    ].join("\n");

    expect(diffTableLines(left, right).map((line) => line.state)).toEqual([
      "same",
      "same",
    ]);
  });
});
