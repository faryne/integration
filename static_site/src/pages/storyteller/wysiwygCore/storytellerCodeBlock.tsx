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
  priority: 1000,

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
            tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { selection } = state;
        if (
          selection.empty &&
          selection.$from.parent.type.name === "paragraph"
        ) {
          const paragraph = selection.$from.parent;
          const match = paragraph.textContent.match(/^```([^\s`]*)$/);
          if (
            match &&
            selection.$from.parentOffset === paragraph.content.size
          ) {
            const paragraphStart = selection.$from.before(
              selection.$from.depth,
            );
            const paragraphEnd = paragraphStart + paragraph.nodeSize;
            const codeBlock = state.schema.nodes.storytellerCodeBlock.create({
              markerId: null,
              language: match[1] || null,
            });
            const tr = state.tr.replaceWith(
              paragraphStart,
              paragraphEnd,
              codeBlock,
            );
            tr.setSelection(
              TextSelection.near(tr.doc.resolve(paragraphStart + 1)),
            );
            tr.scrollIntoView();
            view.dispatch(tr);
            return true;
          }
        }
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
