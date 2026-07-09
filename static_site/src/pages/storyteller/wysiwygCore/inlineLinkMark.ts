import { Mark, mergeAttributes } from "@tiptap/core";

import { isSafeHref, type LinkTargetValue } from "./whitelist";

/**
 * 連結的行內 mark（對應序列化格式裡 a 行內 marker 的 href／target 屬性）。
 *
 * 跟文字顏色是同一種「帶值的行內 marker」，差別在於 href 是自由格式值（不是固定色盤），
 * 資安防線改成限制 scheme（見 whitelist.ts 的 isSafeHref）。這裡在 setLink command 裡
 * 也重複驗證一次——就算呼叫端（Dialog）忘記先驗證，這個 mark 本身也不會套用危險的網址，
 * 不能只靠單一一層防護。
 */

export interface SetLinkOptions {
  href: string;
  target?: LinkTargetValue;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    link: {
      setLink: (options: SetLinkOptions) => ReturnType;
      unsetLink: () => ReturnType;
    };
  }
}

export const InlineLink = Mark.create({
  name: "link",

  addAttributes() {
    return {
      href: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("href"),
      },
      target: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("target"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[href]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const target = HTMLAttributes.target as string | null;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "wysiwyg-link",
        // 開新分頁時一定要加 rel="noopener noreferrer"：防止新分頁透過
        // window.opener 回頭操作原本頁面，這是跟 scheme 限制分開的另一道資安慣例。
        ...(target === "_blank" ? { rel: "noopener noreferrer" } : {}),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setLink:
        ({ href, target }: SetLinkOptions) =>
        ({ commands }) => {
          if (!isSafeHref(href)) return false;
          return commands.setMark(this.name, { href, target: target ?? null });
        },
      unsetLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
