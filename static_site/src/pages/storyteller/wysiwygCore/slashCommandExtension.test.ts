import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { getWysiwygCommand, type WysiwygCommandContext } from "./commands";
import { wysiwygCoreExtensions } from "./extensions";
import { markdownToDoc } from "./parser";
import { canShowSlashCommand, runSlashCommand } from "./slashCommandExtension";

function createEditorWithText(text = "") {
  const editor = new Editor({
    extensions: wysiwygCoreExtensions,
    content: markdownToDoc(""),
  });
  if (text !== "") editor.commands.insertContent(text);
  return editor;
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

describe("SlashCommand", () => {
  it("只在 selection 為空、且目前段落只有 /query 時顯示", () => {
    const editor = createEditorWithText("/標");

    try {
      const range = {
        from: editor.state.selection.from - "/標".length,
        to: editor.state.selection.from,
      };
      expect(canShowSlashCommand(editor.state, range)).toBe(true);

      editor.commands.setContent(markdownToDoc(""));
      editor.commands.insertContent("前文 /標");
      const nonEmptyRange = {
        from: editor.state.selection.from - "/標".length,
        to: editor.state.selection.from,
      };
      expect(canShowSlashCommand(editor.state, nonEmptyRange)).toBe(false);

      editor.commands.setContent(markdownToDoc(""));
      editor.commands.insertContent("/標");
      editor.commands.setTextSelection({
        from: editor.state.selection.from - "/標".length,
        to: editor.state.selection.from,
      });
      expect(canShowSlashCommand(editor.state, range)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("執行 command 前會先刪除 /query 文字", () => {
    const editor = createEditorWithText("/table");
    const command = getWysiwygCommand("insert-table");

    try {
      expect(command).toBeDefined();
      runSlashCommand(
        editor,
        {
          from: editor.state.selection.from - "/table".length,
          to: editor.state.selection.from,
        },
        command!,
        createStubContext(),
      );

      const json = editor.getJSON();
      expect(JSON.stringify(json)).not.toContain("/table");
      expect(json.content?.[0]?.type).toBe("storytellerTable");
    } finally {
      editor.destroy();
    }
  });
});
