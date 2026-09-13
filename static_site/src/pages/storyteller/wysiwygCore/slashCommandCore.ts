import type { Editor, Range } from "@tiptap/core";
import { PluginKey, type EditorState } from "@tiptap/pm/state";

import type { WysiwygCommand, WysiwygCommandContext } from "./commands";

export const slashCommandPluginKey = new PluginKey("storytellerSlashCommand");

// ProseMirror `textBetween` 預設忽略 assetImage 等 atom；補上不會出現在正常輸入的
// 佔位字元，避免「圖片後面打 /」被誤判成空段落。
const ATOM_PLACEHOLDER = "￼";

function isTextOnlySlashQuery(state: EditorState, range: Range) {
  const { selection } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;
  if ($from.parent.type.name !== "paragraph") return false;

  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    "",
    ATOM_PLACEHOLDER,
  );
  const textAfter = $from.parent.textBetween(
    $from.parentOffset,
    $from.parent.content.size,
    "",
    ATOM_PLACEHOLDER,
  );
  return (
    textBefore.startsWith("/") &&
    textAfter === "" &&
    range.from >= $from.start()
  );
}

export function canShowSlashCommand(state: EditorState, range: Range) {
  return isTextOnlySlashQuery(state, range);
}

export function runSlashCommand(
  editor: Editor,
  range: Range,
  command: WysiwygCommand,
  context: WysiwygCommandContext,
) {
  editor.chain().focus().deleteRange(range).run();
  command.run(editor, context);
}
