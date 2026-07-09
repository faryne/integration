import { InputRule, mergeAttributes } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";

import {
  generateMarkerId,
  HEADING_LEVELS,
  type HeadingLevel,
} from "./whitelist";

/** 掃過整份文件，幫任何還沒有 markerId 的段落補一個新的。回傳是否真的有改動，方便呼叫端決定要不要 dispatch。 */
function backfillMarkerIds(initialTr: Transaction, doc: ProseMirrorNode) {
  let tr = initialTr;
  let changed = false;
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && !node.attrs.markerId) {
      tr = tr.setNodeAttribute(pos, "markerId", generateMarkerId());
      changed = true;
    }
  });
  return { tr, changed };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    markerParagraph: {
      /** 0 代表改回一般段落。 */
      setHeadingLevel: (level: HeadingLevel) => ReturnType;
    };
  }
}

function headingTag(level: HeadingLevel): string {
  return level > 0 ? `h${level}` : "p";
}

/**
 * 段落 marker 機制 + 標題（heading）樣式，兩者掛在同一個 node type 上：
 * - 每個段落節點都有一個穩定的 markerId，作為書籤功能的錨點。
 * - headingLevel（0-6）決定要渲染成 <p> 還是 <h1>~<h6>；沒有另外開一個 heading node type，
 *   是因為 marker 的分割/合併/自動補 id 邏輯只寫在這一個地方，標題本質上仍是「一個段落」，
 *   拆成兩個 node type 只會讓 marker 邏輯要維護兩份。
 * - Enter 分割段落時，游標前半段沿用原本的 markerId，後半段拿新的 markerId、標題重置成
 *   預設值（比照 Notion／大多數編輯器習慣：換行後不會整段繼續當標題）。註解（comment mark）
 *   2026-07-09 起改成行內 marker，不再是段落屬性，Enter 分割時不需要特別重置——
 *   跟粗體/顏色/連結/腳注等其他行內 mark 一樣，ProseMirror 預設的分割行為就會正確地
 *   讓 mark 留在它原本包住的文字範圍內。
 * - Backspace 合併段落時直接用 ProseMirror 預設的 joinBackward，
 *   保留在前段落的 node 本身連同它的 markerId／headingLevel 不受影響，不需要額外處理。
 * - appendTransaction 補一個保險：任何時候文件裡出現沒有 markerId 的段落
 *   （例如載入舊內容、貼上新段落），都會自動補上一個新 id。
 */
export const MarkerParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markerId: {
        default: null as string | null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      headingLevel: {
        default: 0 as HeadingLevel,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      { tag: "p", attrs: { headingLevel: 0 } },
      ...HEADING_LEVELS.map((level) => ({
        tag: `h${level}`,
        attrs: { headingLevel: level },
      })),
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = (node.attrs.headingLevel ?? 0) as HeadingLevel;
    return [
      headingTag(level),
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setHeadingLevel:
        (level: HeadingLevel) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { headingLevel: level }),
    };
  },

  addInputRules() {
    // 不用 Tiptap 內建的 textblockTypeInputRule：它底層呼叫 ProseMirror 的
    // setBlockType(pos, pos, type, attrs)，而 setBlockType 是用 attrs 重新
    // type.create(attrs, ...)，沒被指定的屬性一律回退成 schema 預設值——
    // 也就是說用它來套用 headingLevel 會連帶把 markerId／textAlign 都重置掉。
    // 這裡手動實作，把「目前段落既有的 attrs」跟新的 headingLevel 合併後再套用。
    return HEADING_LEVELS.map(
      (level) =>
        new InputRule({
          find: new RegExp(`^(#{${level}})(?!#) $`),
          handler: ({ state, range, chain }) => {
            const $start = state.doc.resolve(range.from);
            const currentAttrs = $start.parent.attrs;
            if (
              !$start
                .node(-1)
                .canReplaceWith(
                  $start.index(-1),
                  $start.indexAfter(-1),
                  this.type,
                )
            ) {
              return;
            }
            chain()
              .command(({ tr }) => {
                tr.delete(range.from, range.to).setBlockType(
                  range.from,
                  range.from,
                  this.type,
                  { ...currentAttrs, headingLevel: level },
                );
                return true;
              })
              .run();
          },
        }),
    );
  },

  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {};
    const headingShortcuts = Object.fromEntries(
      HEADING_LEVELS.map((level) => [
        `Mod-Alt-${level}`,
        () => this.editor.commands.setHeadingLevel(level),
      ]),
    );

    return {
      ...parentShortcuts,
      ...headingShortcuts,
      Enter: () => {
        const { editor } = this;
        const didSplit = editor.commands.splitBlock();
        if (!didSplit) return false;

        const { $from } = editor.state.selection;
        const paragraphStart = $from.before($from.depth);
        editor.commands.command(({ tr }) => {
          tr.setNodeAttribute(paragraphStart, "markerId", generateMarkerId());
          tr.setNodeAttribute(paragraphStart, "headingLevel", 0);
          return true;
        });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey("markerParagraphAutoAssign"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          const { tr, changed } = backfillMarkerIds(newState.tr, newState.doc);
          return changed ? tr : null;
        },
      }),
    ];
  },

  // 初始內容（例如舊資料、還沒 migrate 過的 markdown）載入時完全不會經過
  // appendTransaction——那只在「後續」transaction 上才會被呼叫。如果不在這裡補一次，
  // 使用者在還沒做任何編輯動作前點「加註解」之類需要 markerId 的功能會直接靜默失敗。
  onCreate() {
    const { tr, changed } = backfillMarkerIds(
      this.editor.state.tr,
      this.editor.state.doc,
    );
    if (changed) {
      this.editor.view.dispatch(tr);
    }
  },
});
