import { describe, expect, it } from "vitest";

import { markdownToDoc, parseMarkdownToParagraphs } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

describe("storyteller table marker", () => {
  it("把相鄰同 tableId 的 table row marker 解析成同一個 table node", () => {
    const doc = markdownToDoc(
      [
        '⟦table tableId="tbl_a" rowId="row_1"⟧| 角色 | 任務 |⟦/table⟧',
        '⟦table tableId="tbl_a" rowId="row_2"⟧| 莉亞 | **完成** |⟦/table⟧',
      ].join("\n"),
    );

    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0]).toMatchObject({
      type: "storytellerTable",
      attrs: { tableId: "tbl_a" },
      content: [
        {
          type: "tableRow",
          attrs: { rowId: "row_1" },
          content: [
            { type: "tableCell", content: [{ type: "text", text: "角色" }] },
            { type: "tableCell", content: [{ type: "text", text: "任務" }] },
          ],
        },
        {
          type: "tableRow",
          attrs: { rowId: "row_2" },
          content: [
            { type: "tableCell", content: [{ type: "text", text: "莉亞" }] },
            {
              type: "tableCell",
              content: [
                {
                  type: "text",
                  text: "完成",
                  marks: [{ type: "bold" }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("cell 內容只處理 table-level 的三種 escape", () => {
    const [paragraph] = parseMarkdownToParagraphs(
      '⟦table tableId="tbl_a" rowId="row_1"⟧| A\\|B | C\\\\D | E\\nF | G\\x |⟦/table⟧',
    );

    expect(
      paragraph.tableCells?.map((cell) => cell.map((run) => run.text).join("")),
    ).toEqual(["A|B", "C\\D", "E\nF", "G\\x"]);
  });

  it("欄數不一致時補空 cell，保護 editor table schema", () => {
    const doc = markdownToDoc(
      [
        '⟦table tableId="tbl_a" rowId="row_1"⟧| A | B | C |⟦/table⟧',
        '⟦table tableId="tbl_a" rowId="row_2"⟧| 1 | 2 |⟦/table⟧',
      ].join("\n"),
    );

    expect(doc.content?.[0].content?.[1].content).toHaveLength(3);
    expect(doc.content?.[0].content?.[1].content?.[2]).toEqual({
      type: "tableCell",
      content: [],
    });
  });

  it("serialize table node 成逐列一行 marker 並跳脫 cell 邊界字元", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "storytellerTable",
          attrs: { tableId: "tbl_a" },
          content: [
            {
              type: "tableRow",
              attrs: { rowId: "row_1" },
              content: [
                { type: "tableCell", content: [{ type: "text", text: "A|B" }] },
                {
                  type: "tableCell",
                  content: [{ type: "text", text: "C\\D\nE" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializeDocToMarkdown(doc)).toBe(
      '⟦table tableId="tbl_a" rowId="row_1"⟧| A\\|B | C\\\\D\\nE |⟦/table⟧',
    );
  });
});
