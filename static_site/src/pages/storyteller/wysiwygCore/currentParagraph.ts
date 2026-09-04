import type { Editor } from "@tiptap/core";

function isBookmarkableTextblock(typeName: string): boolean {
  return typeName === "paragraph" || typeName === "storytellerCodeBlock";
}

/** 游標所在可書籤文字區塊的 markerId；不在支援 markerId 的 textblock 上（例如表格 cell）就回 null。 */
export function currentParagraphMarkerId(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  if (!isBookmarkableTextblock($from.parent.type.name)) return null;
  const markerId = $from.parent.attrs.markerId as string | null;
  return markerId || null;
}

/** 游標所在可書籤文字區塊的純文字，給書籤對話框預覽用。 */
export function currentParagraphText(editor: Editor): string {
  const { $from } = editor.state.selection;
  if (!isBookmarkableTextblock($from.parent.type.name)) return "";
  return $from.parent.textContent.replace(/\s+/g, " ").trim();
}
