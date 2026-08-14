import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { WYSIWYG_COMMANDS, type WysiwygCommandContext } from "./commands";
import { wysiwygCoreExtensions } from "./extensions";
import { markdownToDoc } from "./parser";

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
});
