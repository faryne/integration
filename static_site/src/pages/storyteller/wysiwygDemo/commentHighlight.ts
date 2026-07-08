import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { DEFAULT_COMMENT_COLOR, type CommentColorValue } from "./whitelist";

/**
 * 段落的 comment 現在直接是 paragraph node 自己的 attribute（見 markerParagraph.ts），
 * 不再是外部 React state 同步進來的東西，所以這裡不需要自己的 plugin state／transaction
 * meta 橋接——每次 ProseMirror 要畫 decoration 時，直接讀當下的 doc 就好，一定是最新的。
 */
function buildDecorations(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const comment = node.attrs.comment as string | null;
    if (node.type.name === "paragraph" && comment) {
      const color =
        (node.attrs.commentColor as CommentColorValue | null) ??
        DEFAULT_COMMENT_COLOR;
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: `wysiwyg-has-comment wysiwyg-comment-color-${color}`,
          // 純編輯器執行期用的 DOM 屬性，給 hover tooltip 直接讀取內容用，
          // 跟序列化進 markdown 的 comment attribute 是分開的兩件事。
          "data-comment": comment,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

export const CommentHighlight = Extension.create({
  name: "commentHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            return buildDecorations(state.doc);
          },
        },
      }),
    ];
  },
});
