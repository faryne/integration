import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { normalizeCommentRefs, parseCommentRefs } from "./commentRefs";
import { wysiwygCoreExtensions } from "./extensions";
import { markdownToDoc } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

// 經過 tiptap 編輯器走一次「載入 → 存檔」，確認 refs 不會在 mark 轉換中掉資料
const roundTrip = (markdown: string) => {
  const editor = new Editor({
    extensions: wysiwygCoreExtensions,
    content: markdownToDoc(markdown),
  });
  const output = serializeDocToMarkdown(editor.getJSON());
  editor.destroy();
  return output;
};

describe("註解參照 refs", () => {
  it("看不懂的 token 忽略、重複去掉、最多 5 個", () => {
    expect(
      parseCommentRefs(
        "lore:a story:b lore:a steamloom-lore://x lore:c lore:d lore:e lore:f",
      ),
    ).toEqual([
      { kind: "lore", publicId: "a" },
      { kind: "story", publicId: "b" },
      { kind: "lore", publicId: "c" },
      { kind: "lore", publicId: "d" },
      { kind: "lore", publicId: "e" },
    ]);
    expect(normalizeCommentRefs(" bad ")).toBe("");
  });

  it("有參照的註解（含只有參照、沒有文字的）存回去不變", () => {
    const markdown =
      '⟦p1⟧她⟦comment-c1 comment="對齊口頭禪" refs="lore:abc story:d-1"⟧回頭⟦/comment-c1⟧看了⟦comment-c2 comment="" commentColor="blue" refs="lore:abc"⟧一眼⟦/comment-c2⟧⟦/p1⟧';
    const output = roundTrip(markdown);
    expect(output).toMatch(
      /⟦comment-[^ ]+ comment="對齊口頭禪" refs="lore:abc story:d-1"⟧回頭⟦\/comment-[^⟧]+⟧/,
    );
    expect(output).toMatch(
      /⟦comment-[^ ]+ comment="" commentColor="blue" refs="lore:abc"⟧一眼/,
    );
  });

  it("沒有參照的舊註解不會多出 refs 屬性", () => {
    expect(
      roundTrip('⟦p1⟧⟦comment-c1 comment="舊的"⟧字⟦/comment-c1⟧⟦/p1⟧'),
    ).not.toContain("refs=");
  });
});
