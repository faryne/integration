import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

interface InlineAssistantAnchorState {
  pos: number | null;
}

const inlineAssistantAnchorPluginKey =
  new PluginKey<InlineAssistantAnchorState>("storytellerInlineAssistantAnchor");

/**
 * AI 工作區是 ProseMirror decoration，不會進入文件 schema、undo history 或 markdown。
 * transaction 沒有明確換錨點時，位置會跟著 mapping 移動，避免在前文打字後留在舊座標。
 */
export const InlineAssistantAnchor = Extension.create({
  name: "storytellerInlineAssistantAnchor",

  addProseMirrorPlugins() {
    return [
      new Plugin<InlineAssistantAnchorState>({
        key: inlineAssistantAnchorPluginKey,
        state: {
          init: () => ({ pos: null }),
          apply: (transaction, current) => {
            const nextPos = transaction.getMeta(
              inlineAssistantAnchorPluginKey,
            ) as number | null | undefined;
            if (nextPos !== undefined) return { pos: nextPos };
            if (current.pos === null) return current;

            const mapped = transaction.mapping.mapResult(current.pos, 1);
            return { pos: mapped.deleted ? null : mapped.pos };
          },
        },
        props: {
          decorations: (state) => {
            const { pos } = inlineAssistantAnchorPluginKey.getState(state) ?? {
              pos: null,
            };
            if (pos === null) return DecorationSet.empty;

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                Math.min(pos, state.doc.content.size),
                () => {
                  const host = document.createElement("div");
                  host.dataset.storytellerAiInlineAnchor = "true";
                  host.contentEditable = "false";
                  return host;
                },
                {
                  key: "storyteller-ai-inline-anchor",
                  side: 1,
                  ignoreSelection: true,
                },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

/** 找到 marker 對應區塊的尾端；marker 不存在時退到文件末端。 */
function resolveAnchorPosition(editor: Editor, markerId?: string | null) {
  let anchorPos = editor.state.doc.content.size;
  if (!markerId) return anchorPos;

  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.markerId !== markerId) return true;
    anchorPos = pos + node.nodeSize;
    return false;
  });
  return anchorPos;
}

export function setInlineAssistantAnchor(
  editor: Editor,
  markerId?: string | null,
) {
  editor.view.dispatch(
    editor.state.tr.setMeta(
      inlineAssistantAnchorPluginKey,
      resolveAnchorPosition(editor, markerId),
    ),
  );
}

export function clearInlineAssistantAnchor(editor: Editor) {
  editor.view.dispatch(
    editor.state.tr.setMeta(inlineAssistantAnchorPluginKey, null),
  );
}
