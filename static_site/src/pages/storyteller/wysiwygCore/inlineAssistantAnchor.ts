import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

interface InlineAssistantAnchorState {
  markerId: string | null;
  pos: number | null;
}

type InlineAssistantAnchorMeta = { markerId: string | null } | null;

const inlineAssistantAnchorPluginKey =
  new PluginKey<InlineAssistantAnchorState>("storytellerInlineAssistantAnchor");

/**
 * AI 工作區是 ProseMirror decoration，不會進入文件 schema、undo history 或 markdown。
 * 文件異動後會用 markerId 重解位置；marker 消失時降級到文件末端，之後 undo 還能跟回原段。
 */
export const InlineAssistantAnchor = Extension.create({
  name: "storytellerInlineAssistantAnchor",

  addProseMirrorPlugins() {
    // ProseMirror 在跨段落合併等 transaction 中可能重建 widget view；固定 key 只能幫助
    // 一般 decoration diff，不能保證 DOM identity。永遠回傳同一個 host，React portal
    // 才不會在 widget 重建的那一瞬間仍指向已脫離文件的舊節點。
    let host: HTMLElement | null = null;
    const resolveHost = () => {
      if (host) return host;
      host = document.createElement("div");
      host.dataset.storytellerAiInlineAnchor = "true";
      host.contentEditable = "false";
      return host;
    };

    return [
      new Plugin<InlineAssistantAnchorState>({
        key: inlineAssistantAnchorPluginKey,
        state: {
          init: () => ({ markerId: null, pos: null }),
          apply: (transaction, current) => {
            const nextAnchor = transaction.getMeta(
              inlineAssistantAnchorPluginKey,
            ) as InlineAssistantAnchorMeta | undefined;
            if (nextAnchor === null) return { markerId: null, pos: null };
            if (nextAnchor !== undefined) {
              return {
                markerId: nextAnchor.markerId,
                pos: resolveAnchorPosition(
                  transaction.doc,
                  nextAnchor.markerId,
                ),
              };
            }
            if (current.pos === null || !transaction.docChanged) return current;

            // 不能只靠 mapping：段落 split 後舊尾端可能映射到後半段，merge 時 marker
            // 也可能消失但 mapped position 沒被標成 deleted。每次文件異動都用 markerId
            // 重解；找不到時保留 markerId、位置降級到文件末端，undo 復原後才能跟回原段。
            return {
              ...current,
              pos: resolveAnchorPosition(transaction.doc, current.markerId),
            };
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
                resolveHost,
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
function resolveAnchorPosition(doc: ProseMirrorNode, markerId?: string | null) {
  let anchorPos = doc.content.size;
  if (!markerId) return anchorPos;

  doc.descendants((node, pos) => {
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
    editor.state.tr.setMeta(inlineAssistantAnchorPluginKey, {
      markerId: markerId ?? null,
    } satisfies InlineAssistantAnchorMeta),
  );
}

export function clearInlineAssistantAnchor(editor: Editor) {
  editor.view.dispatch(
    editor.state.tr.setMeta(inlineAssistantAnchorPluginKey, null),
  );
}
