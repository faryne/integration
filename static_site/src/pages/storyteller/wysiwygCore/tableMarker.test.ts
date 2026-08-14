import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { exportContentToMarkdown } from "./exportMarkdown";
import { wysiwygCoreExtensions } from "./extensions";
import {
  groupParagraphsByBlockKind,
  markdownToDoc,
  parseMarkdownToParagraphs,
} from "./parser";
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

  it("malformed table marker 無法 parse 時退回純文字段落，不丟原始內容", () => {
    const raw = '⟦table tableId="tbl_a" rowId="row_1"⟧| A | B |';
    const [paragraph] = parseMarkdownToParagraphs(raw);

    expect(paragraph.tableId).toBeUndefined();
    expect(paragraph.tableCells).toBeUndefined();
    expect(paragraph.runs.map((run) => run.text).join("")).toBe(raw);
  });

  it("缺 tableId 時用 per-line fallback，reader 不會誤合併相鄰 table rows", () => {
    const paragraphs = parseMarkdownToParagraphs(
      [
        '⟦table rowId="row_1"⟧| A | B |⟦/table⟧',
        '⟦table rowId="row_2"⟧| 1 | 2 |⟦/table⟧',
      ].join("\n"),
    );
    const groups = groupParagraphsByBlockKind(paragraphs);

    expect(paragraphs.map((paragraph) => paragraph.tableId)).toEqual([
      "tbl_missing_0",
      "tbl_missing_1",
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.blockKind)).toEqual([
      "table",
      "table",
    ]);
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

  it("reader grouping 會把相鄰同 tableId 的 rows 合併成 table group", () => {
    const groups = groupParagraphsByBlockKind(
      parseMarkdownToParagraphs(
        [
          '⟦table tableId="tbl_a" rowId="row_1"⟧| A | B |⟦/table⟧',
          '⟦table tableId="tbl_a" rowId="row_2"⟧| 1 | 2 |⟦/table⟧',
          "⟦p1⟧一般段落⟦/p1⟧",
        ].join("\n"),
      ),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].blockKind).toBe("table");
    expect(groups[0].tableId).toBe("tbl_a");
    expect(groups[0].items.map((item) => item.index)).toEqual([0, 1]);
  });

  it("匯出新 table marker 為標準 markdown table", () => {
    expect(
      exportContentToMarkdown(
        [
          '⟦table tableId="tbl_a" rowId="row_1"⟧| 角色 | 狀態 |⟦/table⟧',
          '⟦table tableId="tbl_a" rowId="row_2"⟧| 莉亞 | **完成\\|確認** |⟦/table⟧',
        ].join("\n"),
      ),
    ).toBe(
      [
        "| 角色 | 狀態 |",
        "| --- | --- |",
        "| 莉亞 | **完成\\|確認** |",
        "",
      ].join("\n"),
    );
  });

  it("匯出舊 table-row 為標準 markdown table，而不是 numbered list", () => {
    expect(
      exportContentToMarkdown(
        [
          "|⟦r1⟧角色|狀態⟦/r1⟧",
          "|⟦r2⟧---|---⟦/r2⟧",
          "|⟦r3⟧莉亞|完成⟦/r3⟧",
        ].join("\n"),
      ),
    ).toBe(
      ["| 角色 | 狀態 |", "| --- | --- |", "| 莉亞 | 完成 |", ""].join("\n"),
    );
  });

  it("手動 command 將連續舊 table-row 段落轉成真表格並保留行內 mark", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(
        [
          "|⟦r1⟧角色|狀態|備註⟦/r1⟧",
          "|⟦r2⟧莉亞|**完成**⟦/r2⟧",
          "⟦p1⟧後文⟦/p1⟧",
        ].join("\n"),
      ),
    });

    try {
      editor.commands.setTextSelection(1);
      expect(editor.commands.convertLegacyTableRowsToStorytellerTable()).toBe(
        true,
      );
      const [table, paragraph] = editor.getJSON().content ?? [];

      expect(table).toMatchObject({
        type: "storytellerTable",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "text", text: "角色" }] },
              { type: "tableCell", content: [{ type: "text", text: "狀態" }] },
              { type: "tableCell", content: [{ type: "text", text: "備註" }] },
            ],
          },
          {
            type: "tableRow",
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
              { type: "tableCell" },
            ],
          },
        ],
      });
      expect(paragraph).toMatchObject({
        type: "paragraph",
        content: [{ type: "text", text: "後文" }],
      });
    } finally {
      editor.destroy();
    }
  });

  it("table schema role 正確標在各自 node 上，供 prosemirror-tables commands 判斷", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(""),
    });

    try {
      expect(editor.schema.nodes.storytellerTable.spec.tableRole).toBe("table");
      expect(editor.schema.nodes.tableRow.spec.tableRole).toBe("row");
      expect(editor.schema.nodes.tableCell.spec.tableRole).toBe("cell");
    } finally {
      editor.destroy();
    }
  });
});
