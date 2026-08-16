import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const EMPTY_PARAGRAPH_HINT =
  "輸入 / 插入區塊；選取文字可套用樣式";

/**
 * 工具列移除後的最低干擾引導：只在「游標目前所在」且真正沒有任何 inline content 的
 * 段落上加 decoration。Storyteller 會用空白段落當敘事留白，不能掃整份文件所有空行，
 * 否則整篇文章會滿滿都是提示文字。
 */
export const EmptyParagraphPlaceholder = Extension.create({
  name: "emptyParagraphPlaceholder",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection } = state;
            if (!selection.empty) return DecorationSet.empty;

            const { $from } = selection;
            const node = $from.parent;
            if (
              node.type.name !== "paragraph" ||
              node.content.size !== 0 ||
              node.attrs.blockKind === "hr"
            ) {
              return DecorationSet.empty;
            }

            const pos = $from.before($from.depth);
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, {
                class: "wysiwyg-empty-paragraph",
                "data-placeholder": EMPTY_PARAGRAPH_HINT,
              }),
            ]);
          },
        },
      }),
    ];
  },
});
