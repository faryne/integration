import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
  getWysiwygCommand,
  slashWysiwygCommands,
  WYSIWYG_COMMANDS,
  type WysiwygCommandContext,
} from "./commands";
import { wysiwygCoreExtensions } from "./extensions";
import { markdownToDoc } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

/**
 * Command Registry 的最小 smoke test（Phase 1 checklist 要求）：確認每個 command 的
 * isActive／isEnabled／isVisible／run 在「空 editor state」下都不會丟例外，不驗證
 * 各自的業務邏輯正確性（那些已經在 Phase -1 playground 用真實瀏覽器互動測過）。
 */

function createEmptyEditor() {
  return new Editor({
    extensions: wysiwygCoreExtensions,
    content: markdownToDoc(""),
  });
}

function createStubContext(): WysiwygCommandContext {
  return {
    isFeatureEnabled: () => true,
    canExportMarkdown: true,
    canInsertAsset: true,
    openLinkDialog: () => {},
    openFootnoteDialog: () => {},
    openCommentDialog: () => {},
    openAssetPicker: () => {},
    exportMarkdown: () => {},
  };
}

describe("WYSIWYG_COMMANDS", () => {
  it("id 都是唯一的", () => {
    const ids = WYSIWYG_COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("isActive／isEnabled／isVisible／run 在空 editor state 下都不會丟例外", () => {
    const editor = createEmptyEditor();
    const context = createStubContext();

    try {
      for (const command of WYSIWYG_COMMANDS) {
        expect(
          () => command.isActive?.(editor),
          `${command.id}.isActive`,
        ).not.toThrow();
        expect(
          () => command.isEnabled?.(editor, context),
          `${command.id}.isEnabled`,
        ).not.toThrow();
        expect(
          () => command.isVisible?.(context),
          `${command.id}.isVisible`,
        ).not.toThrow();
        expect(
          () => command.run(editor, context),
          `${command.id}.run`,
        ).not.toThrow();
      }
    } finally {
      editor.destroy();
    }
  });

  it("isFeatureEnabled 回傳 false 時，footnote／comment 從可見清單消失", () => {
    const context: WysiwygCommandContext = {
      ...createStubContext(),
      isFeatureEnabled: () => false,
    };
    const visible = WYSIWYG_COMMANDS.filter(
      (command) => command.isVisible?.(context) ?? true,
    );
    expect(visible.some((command) => command.id === "footnote")).toBe(false);
    expect(visible.some((command) => command.id === "comment")).toBe(false);
  });

  it("canInsertAsset 為 false 時（頁面沒提供 onRequestInsertAsset），插入圖片從可見清單消失", () => {
    const context: WysiwygCommandContext = {
      ...createStubContext(),
      canInsertAsset: false,
    };
    const visible = WYSIWYG_COMMANDS.filter(
      (command) => command.isVisible?.(context) ?? true,
    );
    expect(visible.some((command) => command.id === "insert-image")).toBe(
      false,
    );
  });

  it("標題 command 涵蓋內文（0）到標題 6，且 id 跟 headingLevel 一一對應", () => {
    const headingCommands = WYSIWYG_COMMANDS.filter(
      (command) => command.group === "heading",
    );
    const ids = headingCommands.map((command) => command.id).sort();
    expect(ids).toEqual([
      "heading-0",
      "heading-1",
      "heading-2",
      "heading-3",
      "heading-4",
      "heading-5",
      "heading-6",
    ]);
  });

  it("不再提供舊 table-row 的新建 command", () => {
    expect(
      WYSIWYG_COMMANDS.some((command) => command.id === "block-kind-table-row"),
    ).toBe(false);
  });

  it("insert-table command 會插入預設 3x3 真表格", () => {
    const editor = createEmptyEditor();
    const command = getWysiwygCommand("insert-table");

    try {
      expect(command?.aliases).toEqual(
        expect.arrayContaining(["表格", "table", "/table"]),
      );
      command?.run(editor, createStubContext());
      const [table] = (editor.getJSON().content ?? []) as Array<{
        type?: string;
        content?: Array<{ content?: unknown[] }>;
      }>;

      expect(table?.type).toBe("storytellerTable");
      expect(table?.content).toHaveLength(3);
      expect(table?.content?.[0].content).toHaveLength(3);
    } finally {
      editor.destroy();
    }
  });

  it("image-layout command 只在選到圖片時啟用，並更新 assetImage layout", () => {
    const emptyEditor = createEmptyEditor();
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc("⟦p1⟧![圖](steamloom-asset://asset_1)⟦/p1⟧"),
    });
    const command = getWysiwygCommand("image-layout-float-right");

    try {
      expect(command).toBeDefined();
      expect(command?.isEnabled?.(emptyEditor, createStubContext())).toBe(
        false,
      );

      editor.commands.setNodeSelection(1);
      expect(command?.isEnabled?.(editor, createStubContext())).toBe(true);
      command?.run(editor, createStubContext());

      expect(serializeDocToMarkdown(editor.getJSON())).toBe(
        '⟦p1⟧![圖](steamloom-asset://asset_1 "layout=float-right")⟦/p1⟧',
      );
    } finally {
      emptyEditor.destroy();
      editor.destroy();
    }
  });

  it("slash command resolver 只列出 block/insert 類 command，不混入行內樣式", () => {
    const editor = createEmptyEditor();

    try {
      const ids = slashWysiwygCommands("", editor, createStubContext()).map(
        (command) => command.id,
      );
      expect(ids).toEqual(
        expect.arrayContaining([
          "heading-1",
          "block-kind-quote",
          "horizontal-rule",
          "insert-table",
          "insert-image",
        ]),
      );
      expect(ids).not.toContain("bold");
      expect(ids).not.toContain("comment");
      expect(ids).not.toContain("export-markdown");
    } finally {
      editor.destroy();
    }
  });

  it("slash command resolver 支援中英文 alias 查詢", () => {
    const editor = createEmptyEditor();

    try {
      const context = createStubContext();
      expect(
        slashWysiwygCommands("標", editor, context).map(
          (command) => command.id,
        ),
      ).toContain("heading-1");
      expect(
        slashWysiwygCommands("blockquote", editor, context).map(
          (command) => command.id,
        ),
      ).toContain("block-kind-quote");
      expect(
        slashWysiwygCommands("table", editor, context).map(
          (command) => command.id,
        ),
      ).toContain("insert-table");
    } finally {
      editor.destroy();
    }
  });

  it("slash command resolver 套用 command registry 的可見性規則", () => {
    const editor = createEmptyEditor();
    const context = { ...createStubContext(), canInsertAsset: false };

    try {
      const ids = slashWysiwygCommands("圖", editor, context).map(
        (command) => command.id,
      );
      expect(ids).not.toContain("insert-image");
    } finally {
      editor.destroy();
    }
  });
});
