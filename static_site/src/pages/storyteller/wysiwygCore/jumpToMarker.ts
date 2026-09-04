import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

function isBookmarkableBlock(node: ProseMirrorNode): boolean {
  return (
    node.type.name === "paragraph" || node.type.name === "storytellerCodeBlock"
  );
}

/** 依 markerId 找出可書籤區塊節點起點；找不到就回 null。 */
export function findParagraphPosByMarkerId(
  doc: ProseMirrorNode,
  markerId: string,
): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (isBookmarkableBlock(node) && node.attrs.markerId === markerId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * 跳到指定段落：先用 data-marker-id 找 DOM 捲過去，再用 setTextSelection 放游標。
 * 不要對編輯區呼叫 .focus()——overflow:auto 容器會被捲回開頭（已知 bug）。
 */
export function jumpToMarker(
  editor: Editor,
  markerId: string,
  pos?: number,
): boolean {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(markerId)
      : markerId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const element = editor.view.dom.querySelector(
    `[data-marker-id="${escaped}"]`,
  );
  element?.scrollIntoView({ block: "start", behavior: "smooth" });

  const nodePos = pos ?? findParagraphPosByMarkerId(editor.state.doc, markerId);
  if (nodePos === null) return false;
  // descendants 給的 pos 是節點起點；游標放到段落內容開頭（pos + 1）。
  return editor.commands.setTextSelection(nodePos + 1);
}
