import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * 腳注的行內 mark（對應序列化格式裡 footnote 行內 marker 的 note 屬性）。
 *
 * 故意不存 id 屬性——marker id（`footnote-<nonce>`）只在序列化時產生，用來讓
 * open/close 標記配對，不是需要在編輯階段保持穩定的東西（跟 span/a 的 mark 一樣，
 * 見 whitelist.ts 的 generateInlineMarkerId 說明）。編輯區只需要「這段文字掛了
 * 哪一則腳注內文」，不需要知道它在故事裡是第幾號、也不需要即時算編號——這是刻意選擇
 * 的簡化版編輯體驗（跟現有加註解一樣：反白提示＋hover 顯示內容，真正的編號／腳注清單
 * 只在讀者看的閱讀頁/預覽渲染）。
 */

export interface SetFootnoteOptions {
  note: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnote: {
      setFootnote: (options: SetFootnoteOptions) => ReturnType;
      unsetFootnote: () => ReturnType;
    };
  }
}

export const InlineFootnote = Mark.create({
  name: "footnote",

  addAttributes() {
    return {
      note: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-note"),
        renderHTML: (attributes: { note?: string | null }) =>
          attributes.note
            ? {
                "data-note": attributes.note,
                class: "wysiwyg-has-footnote",
              }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-note]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFootnote:
        ({ note }: SetFootnoteOptions) =>
        ({ commands }) =>
          commands.setMark(this.name, { note }),
      unsetFootnote:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
