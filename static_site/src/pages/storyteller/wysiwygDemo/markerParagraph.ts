import Paragraph from "@tiptap/extension-paragraph";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { generateMarkerId } from "./whitelist";

/**
 * 段落 marker 機制：
 * - 每個段落節點都有一個穩定的 markerId，作為未來註解功能的錨點。
 * - Enter 分割段落時，游標前半段沿用原本的 markerId，後半段拿新的。
 * - Backspace 合併段落時直接用 ProseMirror 預設的 joinBackward，
 *   保留在前段落的 node 本身連同它的 markerId 不受影響，不需要額外處理。
 * - appendTransaction 補一個保險：任何時候文件裡出現沒有 markerId 的段落
 *   （例如載入舊內容、貼上新段落），都會自動補上一個新 id。
 */
export const MarkerParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markerId: {
        default: null as string | null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        const didSplit = editor.commands.splitBlock();
        if (!didSplit) return false;

        const { $from } = editor.state.selection;
        const paragraphStart = $from.before($from.depth);
        editor.commands.command(({ tr }) => {
          tr.setNodeAttribute(paragraphStart, "markerId", generateMarkerId());
          return true;
        });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey("markerParagraphAutoAssign"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          let tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name === "paragraph" && !node.attrs.markerId) {
              tr = tr.setNodeAttribute(pos, "markerId", generateMarkerId());
              changed = true;
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});
