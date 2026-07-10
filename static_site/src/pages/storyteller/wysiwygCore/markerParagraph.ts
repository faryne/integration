import { InputRule, mergeAttributes } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";

import {
  DEFAULT_BLOCK_KIND,
  DEFAULT_HEADING_LEVEL,
  generateMarkerId,
  HEADING_LEVELS,
  type BlockKindValue,
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
      /** 0 代表改回一般段落。跟 blockKind 互斥，設定非 0 的標題層級會把 blockKind
       * 重置成 "none"。 */
      setHeadingLevel: (level: HeadingLevel) => ReturnType;
      /** "none" 代表改回一般段落。跟 headingLevel 互斥，設定非 "none" 的引用/清單
       * 種類會把 headingLevel 重置成 0。 */
      setBlockKind: (kind: BlockKindValue) => ReturnType;
    };
  }
}

function headingTag(level: HeadingLevel): string {
  return level > 0 ? `h${level}` : "p";
}

/**
 * 段落 marker 機制 + 標題（heading）樣式 + 引用/清單種類（blockKind），三者掛在同一個
 * node type 上：
 * - 每個段落節點都有一個穩定的 markerId，作為書籤功能的錨點。
 * - headingLevel（0-6）決定要渲染成 <p> 還是 <h1>~<h6>；沒有另外開一個 heading node type，
 *   是因為 marker 的分割/合併/自動補 id 邏輯只寫在這一個地方，標題本質上仍是「一個段落」，
 *   拆成兩個 node type 只會讓 marker 邏輯要維護兩份。
 * - blockKind（"none"/"quote"/"bullet"/"number"）決定這個段落是不是引用/清單項目，
 *   2026-07-10 加入，跟 headingLevel 互斥（見 setHeadingLevel／setBlockKind 命令）。
 *   沒有另外開 Blockquote/BulletList/OrderedList node type——跟標題同樣的理由：這裡
 *   仍然是「一個段落」，連續同 blockKind 的段落要合併成一個視覺區塊（`<blockquote>`／
 *   `<ul>`／`<ol>`）純粹是渲染時的事：閱讀頁（`StorytellerWysiwygMarkdown.tsx`，純
 *   React 渲染，沒有 schema 限制）直接輸出真正巢狀的 DOM；編輯區（這裡，受 ProseMirror
 *   flat 段落 schema 限制）改用 CSS 對相鄰同 `data-block-kind` 段落做視覺分組（見
 *   `StorytellerWysiwygEditor.tsx` 的樣式），沒有真的 DOM 巢狀。
 * - Enter 分割段落時，游標前半段沿用原本的 markerId，後半段拿新的 markerId、標題重置成
 *   預設值（比照 Notion／大多數編輯器習慣：換行後不會整段繼續當標題）。blockKind 則刻意
 *   延續（清單/引用中按 Enter 應該接著下一個項目/引用行，不是跳出），splitBlock 預設就會
 *   把目前段落的 attrs（含 blockKind）原樣複製到新段落，不用額外處理；但如果目前這行
 *   是「空的」清單項目/引用行，按 Enter 要改成跳出（比照大多數清單編輯器習慣：空項目
 *   按 Enter 代表打完了，不是要再加一個空項目），這個情況提早攔截、不呼叫 splitBlock。
 *   註解（comment mark）2026-07-09 起改成行內 marker，不再是段落屬性，Enter 分割時
 *   不需要特別重置——跟粗體/顏色/連結/腳注等其他行內 mark 一樣，ProseMirror 預設的
 *   分割行為就會正確地讓 mark 留在它原本包住的文字範圍內。
 * - Backspace 合併段落時直接用 ProseMirror 預設的 joinBackward，
 *   保留在前段落的 node 本身連同它的 markerId／headingLevel／blockKind 不受影響，
 *   不需要額外處理。
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
      blockKind: {
        default: DEFAULT_BLOCK_KIND,
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
    const blockKind = (node.attrs.blockKind ??
      DEFAULT_BLOCK_KIND) as BlockKindValue;
    // data-block-kind 只在非 "none" 時輸出，給編輯區的 CSS 分組樣式當選擇器用
    // （見 StorytellerWysiwygEditor.tsx），不是序列化格式的一部分——序列化永遠是走
    // parser.ts／serializer.ts 那條路，不會去讀這個 DOM 屬性。
    const blockKindAttrs =
      blockKind !== DEFAULT_BLOCK_KIND ? { "data-block-kind": blockKind } : {};
    return [
      headingTag(level),
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        blockKindAttrs,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setHeadingLevel:
        (level: HeadingLevel) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            headingLevel: level,
            blockKind: DEFAULT_BLOCK_KIND,
          }),
      setBlockKind:
        (kind: BlockKindValue) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            blockKind: kind,
            headingLevel: DEFAULT_HEADING_LEVEL,
          }),
    };
  },

  addInputRules() {
    // 不用 Tiptap 內建的 textblockTypeInputRule：它底層呼叫 ProseMirror 的
    // setBlockType(pos, pos, type, attrs)，而 setBlockType 是用 attrs 重新
    // type.create(attrs, ...)，沒被指定的屬性一律回退成 schema 預設值——
    // 也就是說用它來套用 headingLevel/blockKind 會連帶把 markerId／textAlign 都重置掉。
    // 這裡手動實作，把「目前段落既有的 attrs」跟新的屬性合併後再套用，標題/引用/清單的
    // input rule 都共用這同一套邏輯（只有要合併進去的 attrsPatch 不同）。
    const nodeType = this.type;
    const applyPrefixInputRule = (
      find: RegExp,
      attrsPatch: Record<string, unknown>,
    ) =>
      new InputRule({
        find,
        handler: ({ state, range, chain }) => {
          const $start = state.doc.resolve(range.from);
          const currentAttrs = $start.parent.attrs;
          if (
            !$start
              .node(-1)
              .canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)
          ) {
            return;
          }
          chain()
            .command(({ tr }) => {
              tr.delete(range.from, range.to).setBlockType(
                range.from,
                range.from,
                nodeType,
                { ...currentAttrs, ...attrsPatch },
              );
              return true;
            })
            .run();
        },
      });

    return [
      ...HEADING_LEVELS.map((level) =>
        applyPrefixInputRule(new RegExp(`^(#{${level}})(?!#) $`), {
          headingLevel: level,
          blockKind: DEFAULT_BLOCK_KIND,
        }),
      ),
      applyPrefixInputRule(/^> $/, {
        blockKind: "quote" satisfies BlockKindValue,
        headingLevel: DEFAULT_HEADING_LEVEL,
      }),
      applyPrefixInputRule(/^- $/, {
        blockKind: "bullet" satisfies BlockKindValue,
        headingLevel: DEFAULT_HEADING_LEVEL,
      }),
      applyPrefixInputRule(/^\d+\. $/, {
        blockKind: "number" satisfies BlockKindValue,
        headingLevel: DEFAULT_HEADING_LEVEL,
      }),
    ];
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
        const { $from } = editor.state.selection;
        const currentBlockKind = ($from.parent.attrs.blockKind ??
          DEFAULT_BLOCK_KIND) as BlockKindValue;
        const isCurrentParagraphEmpty = $from.parent.textContent.trim() === "";

        // 在空白的清單項目/引用行按 Enter：跳出清單/引用（變回一般段落），不新增
        // 新的一行——比照大多數清單編輯器的習慣，空項目按 Enter 代表打完了。
        if (
          currentBlockKind !== DEFAULT_BLOCK_KIND &&
          isCurrentParagraphEmpty
        ) {
          const paragraphStart = $from.before($from.depth);
          return editor.commands.command(({ tr }) => {
            tr.setNodeAttribute(
              paragraphStart,
              "blockKind",
              DEFAULT_BLOCK_KIND,
            );
            return true;
          });
        }

        const didSplit = editor.commands.splitBlock();
        if (!didSplit) return false;

        const { $from: newFrom } = editor.state.selection;
        const paragraphStart = newFrom.before(newFrom.depth);
        editor.commands.command(({ tr }) => {
          tr.setNodeAttribute(paragraphStart, "markerId", generateMarkerId());
          tr.setNodeAttribute(paragraphStart, "headingLevel", 0);
          // blockKind 故意不重置：清單/引用中按 Enter（非空行）應該延續同一種類型
          // （下一個清單項目/引用行），splitBlock 預設就會把目前段落的 blockKind
          // 原樣複製到新段落，不需要額外處理。
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
