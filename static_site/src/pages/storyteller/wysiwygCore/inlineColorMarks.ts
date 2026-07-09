import { Mark, mergeAttributes } from "@tiptap/core";

import type { BgColorValue, TextColorValue } from "./whitelist";

/**
 * 文字前景色／背景色的行內 mark（對應序列化格式裡的 span 行內 marker 的 textColor／bgColor 屬性）。
 *
 * 兩個獨立的 mark，可以各自開關、也可以同時套在同一段文字上（parser/serializer 會把
 * 兩者合成同一個 `⟦span-id textColor=... bgColor=...⟧`）。編輯區用 class 呈現（樣式定義在
 * StorytellerWysiwygEditor.tsx 的 sx 裡），顏色值一律取自白名單固定色盤、不接受自填 CSS。
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (value: TextColorValue) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    bgColor: {
      setBgColor: (value: BgColorValue) => ReturnType;
      unsetBgColor: () => ReturnType;
    };
  }
}

export const TextColor = Mark.create({
  name: "textColor",

  addAttributes() {
    return {
      value: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-text-color"),
        renderHTML: (attributes: { value?: string | null }) =>
          attributes.value
            ? {
                "data-text-color": attributes.value,
                class: `wysiwyg-textcolor-${attributes.value}`,
              }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-text-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (value: TextColorValue) =>
        ({ commands }) =>
          commands.setMark(this.name, { value }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export const BgColor = Mark.create({
  name: "bgColor",

  addAttributes() {
    return {
      value: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-bg-color"),
        renderHTML: (attributes: { value?: string | null }) =>
          attributes.value
            ? {
                "data-bg-color": attributes.value,
                class: `wysiwyg-bgcolor-${attributes.value}`,
              }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-bg-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setBgColor:
        (value: BgColorValue) =>
        ({ commands }) =>
          commands.setMark(this.name, { value }),
      unsetBgColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
