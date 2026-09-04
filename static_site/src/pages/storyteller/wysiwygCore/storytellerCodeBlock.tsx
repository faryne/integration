import CodeIcon from "@mui/icons-material/Code";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

import { StorytellerCodeBlockFrame } from "./storytellerCodeBlockView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    storytellerCodeBlock: {
      /** 插入真正的 code block 節點；markerId 交給共用 backfill 保險機制補齊。 */
      insertStorytellerCodeBlock: (options?: {
        language?: string | null;
        content?: string;
      }) => ReturnType;
    };
  }
}

function normalizeLanguage(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized === "" ? null : normalized;
}

function StorytellerCodeBlockNodeView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const markerId = (node.attrs.markerId as string | null) ?? null;
  const language = normalizeLanguage(node.attrs.language);
  const content = node.textContent;

  return (
    <NodeViewWrapper
      data-drag-handle
      className={selected ? "ProseMirror-selectednode" : undefined}
    >
      <StorytellerCodeBlockFrame
        markerId={markerId}
        language={language}
        content={content}
        editableLanguage
        onLanguageChange={(nextLanguage) =>
          updateAttributes({ language: normalizeLanguage(nextLanguage) })
        }
      >
        <NodeViewContent />
      </StorytellerCodeBlockFrame>
    </NodeViewWrapper>
  );
}

export const StorytellerCodeBlock = Node.create({
  name: "storytellerCodeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  addAttributes() {
    return {
      markerId: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute("data-marker-id") || null,
        renderHTML: (attributes) =>
          attributes.markerId
            ? { "data-marker-id": attributes.markerId as string }
            : {},
      },
      language: {
        default: null as string | null,
        parseHTML: (element) =>
          element.getAttribute("data-language") ||
          element.querySelector("code")?.className.replace(/^language-/, "") ||
          null,
        renderHTML: (attributes) =>
          attributes.language
            ? { "data-language": String(attributes.language) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "pre[data-storyteller-code-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const language = normalizeLanguage(node.attrs.language);
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-storyteller-code-block": "",
      }),
      ["code", language ? { class: `language-${language}` } : {}, 0],
    ];
  },

  addCommands() {
    return {
      insertStorytellerCodeBlock:
        (options) =>
        ({ state, dispatch }) => {
          const codeBlock = state.schema.nodes.storytellerCodeBlock.create(
            {
              markerId: null,
              language: normalizeLanguage(options?.language),
            },
            options?.content ? state.schema.text(options.content) : undefined,
          );
          if (dispatch) {
            const from = state.selection.from;
            const tr = state.tr
              .replaceSelectionWith(codeBlock)
              .scrollIntoView();
            const pos = tr.mapping.map(from);
            // 插入的 code block 沒有內容時（options.content 沒帶），節點本身只佔
            // 2 個位置（open+close），如果它剛好落在文件最後面，pos+1 會等於
            // 文件真正的結尾再往後多 1，resolve 直接丟 RangeError——這裡夾在
            // 文件實際大小內，跟其他地方 clamp 位置的做法一致。
            const clampedPos = Math.min(pos + 1, tr.doc.content.size);
            tr.setSelection(TextSelection.near(tr.doc.resolve(clampedPos)));
            dispatch(tr);
          }
          return true;
        },
    };
  },

  // 「打三個反引號按 Enter 轉成程式碼區塊」的判斷不能放在這裡——這個
  // extension 是獨立的 Node，跟 MarkerParagraph 各自的 Enter keyboard
  // shortcut 是兩個獨立的 keymap plugin，MarkerParagraph 繼承自 Tiptap
  // 內建 Paragraph 的 priority 是 1000，對任何段落的 Enter 一律自己處理、
  // 不會 return false 讓其他 extension 接手，所以不管這裡設多高 priority
  // 都排不到它前面（實測過：設到 1000 平手時反而讓 splitBlock() 內部的
  // schema defaultType 解析變成這個 node，Enter 分割任何段落都會生出空的
  // 程式碼區塊——比原本的問題更嚴重）。轉換邏輯已經搬到
  // markerParagraph.ts 的 Enter handler 裡（同一個 handler，判斷不成立
  // 才落到原本的段落分割邏輯），這裡只保留「游標已經在程式碼區塊內按
  // Enter＝插入換行」這個案例——這個案例不需要跟 MarkerParagraph 搶
  // priority，因為 MarkerParagraph 自己在 `$from.parent.type.name !==
  // "paragraph"` 時就會 return false 讓出，正常 fallback 到這裡。
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { selection } = state;
        if (
          !selection.empty ||
          selection.$from.parent.type.name !== this.name
        ) {
          return false;
        }
        view.dispatch(state.tr.insertText("\n").scrollIntoView());
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(StorytellerCodeBlockNodeView);
  },
});

export { CodeIcon as StorytellerCodeBlockIcon };
