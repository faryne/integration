import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { wysiwygCoreExtensions } from "./extensions";
import { markdownToDoc, parseMarkdownToParagraphs } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

describe("storyteller code block", () => {
  it("把 fenced code block 解析成單一 storytellerCodeBlock node", () => {
    const doc = markdownToDoc(
      [
        '```go id="code_1"',
        "func main() {",
        '\tfmt.Println("hi")',
        "}",
        "```",
      ].join("\n"),
    );

    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0]).toEqual({
      type: "storytellerCodeBlock",
      attrs: { markerId: "code_1", language: "go" },
      content: [
        {
          type: "text",
          text: 'func main() {\n\tfmt.Println("hi")\n}',
        },
      ],
    });
  });

  it("序列化 storytellerCodeBlock 時輸出 GFM fence 與 id 屬性", () => {
    expect(
      serializeDocToMarkdown({
        type: "doc",
        content: [
          {
            type: "storytellerCodeBlock",
            attrs: { markerId: "code_1", language: "json" },
            content: [{ type: "text", text: '{ "ok": true }' }],
          },
        ],
      }),
    ).toBe(['```json id="code_1"', '{ "ok": true }', "```"].join("\n"));
  });

  it("code block 內容不解析行內 mark", () => {
    const [paragraph] = parseMarkdownToParagraphs(
      ["```typescript", "**not bold**", "```"].join("\n"),
    );

    expect(paragraph.codeBlock).toBe(true);
    expect(paragraph.runs).toEqual([{ text: "**not bold**", marks: [] }]);
  });

  it("insert command 建立真正 code block", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(""),
    });

    try {
      expect(
        editor.commands.insertStorytellerCodeBlock({ language: "go" }),
      ).toBe(true);
      expect(editor.state.selection.$from.parent.type.name).toBe(
        "storytellerCodeBlock",
      );
    } finally {
      editor.destroy();
    }
  });
});
