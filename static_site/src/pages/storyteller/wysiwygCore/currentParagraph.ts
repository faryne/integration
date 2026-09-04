import type { Editor } from "@tiptap/core";

/** 游標所在段落的 markerId；不在 paragraph 上（例如表格 cell）就回 null。 */
export function currentParagraphMarkerId(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "paragraph") return null;
  const markerId = $from.parent.attrs.markerId as string | null;
  return markerId || null;
}

/** 游標所在段落的純文字，給書籤對話框預覽用。 */
export function currentParagraphText(editor: Editor): string {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "paragraph") return "";
  return $from.parent.textContent.replace(/\s+/g, " ").trim();
}
