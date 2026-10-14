import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// 長文捲來捲去容易找不到剛剛打字的地方：游標所在的段落掛上這個 class 做視覺標示，
// 捲軸標記、「回到輸入位置」、記住游標位置見 StorytellerEditorCaretFocus.tsx。
export const CARET_BLOCK_CLASS = "storyteller-caret-block";

/** 游標所在、帶 markerId 的最近區塊（段落／標題／code block，表格儲存格裡的段落也算）。 */
export function caretBlock(
  state: EditorState,
): { pos: number; node: ProseMirrorNode } | null {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth);
    if ("markerId" in node.attrs) return { pos: $head.before(depth), node };
  }
  return null;
}

export const CaretFocus = Extension.create({
  name: "caretFocus",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("caretFocus"),
        props: {
          decorations(state) {
            const block = caretBlock(state);
            return block
              ? DecorationSet.create(state.doc, [
                  Decoration.node(block.pos, block.pos + block.node.nodeSize, {
                    class: CARET_BLOCK_CLASS,
                  }),
                ])
              : null;
          },
        },
      }),
    ];
  },
});
