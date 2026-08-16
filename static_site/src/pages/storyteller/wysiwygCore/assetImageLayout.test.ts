import { describe, expect, it } from "vitest";

import { exportContentToMarkdown } from "./exportMarkdown";
import { markdownToDoc, parseMarkdownToParagraphs } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

describe("asset image layout", () => {
  it("從圖片 title 解析 assetImage layout", () => {
    const content =
      '⟦p1⟧![圖](steamloom-asset://asset_1 "layout=float-left")⟦/p1⟧';
    const [paragraph] = parseMarkdownToParagraphs(
      content,
    );

    expect(paragraph.runs[0]).toMatchObject({
      assetPublicId: "asset_1",
      assetLayout: "float-left",
    });

    const reparsedDoc = markdownToDoc(serializeDocToMarkdown(markdownToDoc(content)));
    expect(reparsedDoc.content?.[0].content?.[0].attrs).toMatchObject({
      layout: "float-left",
    });
  });

  it("序列化非 block layout 到圖片自身語法，block 則維持舊格式", () => {
    expect(
      serializeDocToMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { markerId: "p1", headingLevel: 0, blockKind: "none" },
            content: [
              {
                type: "assetImage",
                attrs: {
                  publicId: "asset_1",
                  alt: "左圖",
                  layout: "float-left",
                },
              },
            ],
          },
          {
            type: "paragraph",
            attrs: { markerId: "p2", headingLevel: 0, blockKind: "none" },
            content: [
              {
                type: "assetImage",
                attrs: { publicId: "asset_2", alt: "全寬", layout: "block" },
              },
            ],
          },
        ],
      }),
    ).toBe(
      [
        '⟦p1⟧![左圖](steamloom-asset://asset_1 "layout=float-left")⟦/p1⟧',
        "⟦p2⟧![全寬](steamloom-asset://asset_2)⟦/p2⟧",
      ].join("\n"),
    );
  });

  it("舊圖片沒有 layout 時維持 block 行為並輸出舊格式", () => {
    const doc = markdownToDoc("⟦p1⟧![舊圖](steamloom-asset://asset_1)⟦/p1⟧");

    expect(doc.content?.[0].content?.[0].attrs).toMatchObject({
      layout: "block",
    });
    expect(serializeDocToMarkdown(doc)).toBe(
      "⟦p1⟧![舊圖](steamloom-asset://asset_1)⟦/p1⟧",
    );
  });

  it("匯出 markdown 時 layout 退化成一般圖片語法", () => {
    expect(
      exportContentToMarkdown(
        '⟦p1⟧![圖](steamloom-asset://asset_1 "layout=float-right")⟦/p1⟧',
      ),
    ).toBe("![圖](steamloom-asset://asset_1)\n");
  });
});
