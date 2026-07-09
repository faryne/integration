import { Mark, mergeAttributes } from "@tiptap/core";

import { DEFAULT_COMMENT_COLOR, type CommentColorValue } from "./whitelist";

/**
 * 註解的行內 mark（對應序列化格式裡 comment 行內 marker 的 comment／commentColor 屬性）。
 *
 * 2026-07-09 起註解從段落屬性改成行內 marker：原本掛在整個段落上（跟 align 共用同一個
 * 段落 marker），但使用者可能只想針對段落裡的一小段文字加註解，不一定是整段——所以改成
 * 跟文字顏色/連結/腳注一樣，走選取範圍的行內 marker 機制。
 *
 * 故意不存 id 屬性——marker id（`comment-<nonce>`）只在序列化時產生，用來讓 open/close
 * 標記配對，不是需要在編輯階段保持穩定的東西（跟 span/a/footnote 的 mark 一樣，見
 * whitelist.ts 的 generateInlineMarkerId 說明）。
 *
 * 只在編輯區顯示（`wysiwyg-has-comment`／`wysiwyg-comment-color-{color}` class 由
 * StorytellerWysiwygEditor.tsx 的 COMMENT_HIGHLIGHT_SX 套樣式），閱讀頁完全不渲染
 * 這個 mark 的任何內容——StorytellerWysiwygMarkdown.tsx 從來不讀 run.comment。
 */

export interface SetCommentOptions {
  comment: string;
  commentColor?: CommentColorValue;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (options: SetCommentOptions) => ReturnType;
      unsetComment: () => ReturnType;
    };
  }
}

export const InlineComment = Mark.create({
  name: "comment",

  addAttributes() {
    return {
      // comment 的 renderHTML 一併決定 class（需要同時看 commentColor 的值），Tiptap
      // 每個屬性的 renderHTML 收到的是這個 mark 完整的屬性物件，不是只有自己那一個值。
      comment: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-comment"),
        renderHTML: (attributes: {
          comment?: string | null;
          commentColor?: CommentColorValue | null;
        }) => {
          if (!attributes.comment) return {};
          const color = attributes.commentColor ?? DEFAULT_COMMENT_COLOR;
          return {
            "data-comment": attributes.comment,
            class: `wysiwyg-has-comment wysiwyg-comment-color-${color}`,
          };
        },
      },
      commentColor: {
        default: null as CommentColorValue | null,
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute(
            "data-comment-color",
          ) as CommentColorValue | null) ?? null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setComment:
        ({ comment, commentColor }: SetCommentOptions) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            comment,
            commentColor: commentColor ?? DEFAULT_COMMENT_COLOR,
          }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
