import { InputRule, mergeAttributes } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";

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
      /** 在游標處分割段落，前半段沿用原本的 markerId，後半段拿新的 markerId、標題重置成
       * 一般段落——跟使用者按 Enter 完全同一套行為，Enter 快速鍵跟貼上多行文字都靠這個
       * command，避免兩處各寫一份邏輯、行為兜不起來。 */
      splitParagraphFresh: () => ReturnType;
      /** 把目前段落轉成分隔線，段落原有內容（如果有）會被移到後面新插入的段落，游標
       * 也跟著移過去——輸入 `---` 的 input rule、工具列／右鍵選單／slash 選單的插入
       * 分隔線都呼叫這個 command。已知 Bug 記錄第 11 項：早期版本是直接刪除原內容，
       * 圖片（inline atom）緊接在游標前時會被整個吃掉，現在改成搬移保留。 */
      insertHorizontalRule: () => ReturnType;
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
 * - blockKind（"none"/"quote"/"bullet"/"number"/"hr"）決定這個段落是不是引用/清單/
 *   分隔線，2026-07-10 加入（分隔線 "hr" 2026-08-08 加入），跟 headingLevel 互斥（見
 *   setHeadingLevel／setBlockKind 命令）。沒有另外開 Blockquote/BulletList/OrderedList/
 *   HorizontalRule node type——跟標題同樣的理由：這裡仍然是「一個段落」，連續同
 *   blockKind 的段落要合併成一個視覺區塊（`<blockquote>`／`<ul>`／`<ol>`）純粹是渲染時
 *   的事：閱讀頁（`StorytellerWysiwygMarkdown.tsx`，純 React 渲染，沒有 schema 限制）
 *   直接輸出真正巢狀的 DOM；編輯區（這裡，受 ProseMirror
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
        // 編輯區跳轉（大綱／書籤）靠 DOM 上的 data-marker-id 找段落。
        // 這份 schema 不會拿去 generateHTML()／閱讀頁，所以不會外洩到已發布內容。
        renderHTML: (attributes) =>
          attributes.markerId
            ? { "data-marker-id": attributes.markerId as string }
            : {},
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
      splitParagraphFresh:
        () =>
        ({ commands, tr, dispatch }) => {
          const didSplit = commands.splitBlock();
          if (!didSplit) return false;
          if (dispatch) {
            const { $from } = tr.selection;
            const paragraphStart = $from.before($from.depth);
            tr.setNodeAttribute(paragraphStart, "markerId", generateMarkerId());
            tr.setNodeAttribute(paragraphStart, "headingLevel", 0);
          }
          return true;
        },
      insertHorizontalRule:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;
          const paragraphStart = $from.before($from.depth);
          const paragraphNode = $from.parent;
          const paragraphEnd = paragraphStart + paragraphNode.nodeSize;
          // 保留原段落內容（例如圖片這種 inline atom，或使用者原本就在打的文字），
          // 搬到分隔線後面新插入的段落，不要整個丟掉——原本的做法是直接
          // tr.delete 清空，圖片緊接在游標前時會連圖片一起被吃掉（已知 Bug
          // 記錄第 11 項）。輸入 `---` 觸發的 input rule 呼叫這個 command 之前
          // 必須先把比對到的 "---" 文字自己刪掉（見 addInputRules 那條 rule 的
          // 註解／已知 Bug 記錄第 18 項），這裡收到的 fragment 才會是真的空的，
          // 不會把 "---" 觸發文字誤當成「使用者想保留的內容」搬到新段落去。
          const leftoverContent = paragraphNode.content;
          if (dispatch) {
            const tr = state.tr;
            if (leftoverContent.size > 0) {
              tr.delete(paragraphStart + 1, paragraphEnd - 1);
            }
            tr.setNodeAttribute(
              paragraphStart,
              "blockKind",
              "hr" satisfies BlockKindValue,
            );
            tr.setNodeAttribute(
              paragraphStart,
              "headingLevel",
              DEFAULT_HEADING_LEVEL,
            );
            const insertPos = tr.mapping.map(paragraphEnd);
            const newParagraph = state.schema.nodes.paragraph.create(
              {
                markerId: generateMarkerId(),
                headingLevel: DEFAULT_HEADING_LEVEL,
                blockKind: DEFAULT_BLOCK_KIND,
              },
              leftoverContent,
            );
            tr.insert(insertPos, newParagraph);
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
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
      new InputRule({
        find: /^---$/,
        // 已知 Bug 記錄第 18 項：這裡原本沒有刪除比對到的 "---" 文字就直接呼叫
        // insertHorizontalRule()，跟其他 input rule（標題/引用/清單）都會先
        // `tr.delete(range.from, range.to)` 不一樣。過去能正常運作是因為
        // insertHorizontalRule() 舊版實作會無條件清空整個段落內容，"---" 文字
        // 沒被單獨刪除也會被那個清空邏輯一起帶走，剛好掩蓋了這裡少刪的問題。
        // Bug #12/#14 修復把 insertHorizontalRule() 改成「保留段落原有內容、
        // 搬到分隔線後面的新段落」（避免圖片被連帶吃掉），這裡的 "---" 文字因此
        // 變成「原有內容」被一併保留、搬到新段落，畫面上分隔線下一行多出一行
        // "--"（regex 是 `^---$`，實際觸發時最後一個 `-` 通常還沒被這個 handler
        // 看到，所以留下的是頭兩個字元）。這裡補上跟其他 input rule 一致的
        // `tr.delete(range.from, range.to)`，觸發文字先被刪乾淨，
        // insertHorizontalRule() 收到的段落內容就會是真的空的，不會再有東西
        // 可以「保留」。
        handler: ({ chain, range }) => {
          chain()
            .command(({ tr }) => {
              tr.delete(range.from, range.to);
              return true;
            })
            .insertHorizontalRule()
            .run();
        },
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
        const { selection } = editor.state;

        // 選到的是節點本身（圖片這種 inline atom，或表格這種 block 節點）——
        // NodeSelection 的 $from 落在節點「前面」，如果照下面 splitParagraphFresh
        // 的邏輯用 $from 位置分割，會把新段落插到節點上面而不是下面（已知 Bug
        // 記錄第 13 項：圖片實測發現方向反了）。改用整個節點後面插入新段落，
        // 游標移過去讓使用者可以接著打字。
        //
        // 插入位置一定要用 selection.to（NodeSelection 自帶的「節點結束位置」，
        // 定義是 `pos + node.nodeSize`），不能用 $from.after($from.depth)——
        // 已知 Bug 記錄第 20 項：表格（`group: "block"`，直接掛在文件最上層，
        // $from.depth 是 0）用 $from.after(0) 會直接拋出 RangeError: There is
        // no position after the top-level node，整個 handler 因為例外而悄悄
        // 失敗（外層 keymap 吞掉例外，Enter 看起來像沒反應）。圖片是 inline
        // atom、巢狀在段落裡（depth 至少是 1）才沒踩到這個問題，這裡改用
        // selection.to 是因為它用單純的位置加總計算，不管節點在哪個巢狀深度
        // 都不會有這個邊界情況。
        if (selection instanceof NodeSelection) {
          const nodeEnd = selection.to;
          return editor.commands.command(({ tr, dispatch, state }) => {
            if (dispatch) {
              const newParagraph = state.schema.nodes.paragraph.create({
                markerId: generateMarkerId(),
                headingLevel: DEFAULT_HEADING_LEVEL,
                blockKind: DEFAULT_BLOCK_KIND,
              });
              tr.insert(nodeEnd, newParagraph);
              tr.setSelection(TextSelection.near(tr.doc.resolve(nodeEnd + 1)));
              dispatch(tr.scrollIntoView());
            }
            return true;
          });
        }

        const { $from } = selection;

        // 已知 Bug 記錄第 19／20 項：表格 cell 內按 Enter 一律不做任何事，跟多數
        // 編輯器（包含 Notion）一致——游標停在 cell 內是打字的日常狀態，不該被
        // Enter 意外帶出表格。第 19 項原本有一版「游標在最後一個 cell 尾端才
        // 斷行」的折衷方案，但第 20 項補上表格左上角的 grip handle（點一下選取
        // 整個表格，變成真正的 NodeSelection）之後，那個折衷方案就多餘了——
        // 斷行統一走「先用 grip 選取整個表格，再按 Enter」這條路徑（走上面的
        // NodeSelection 分支，跟圖片同一套邏輯），不需要在 cell 內特別處理，
        // 兩條路徑並存反而讓規則變得不一致，所以拿掉。
        if ($from.parent.type.name !== "paragraph") return false;

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

        // blockKind 故意不重置：清單/引用中按 Enter（非空行）應該延續同一種類型
        // （下一個清單項目/引用行），splitBlock 預設就會把目前段落的 blockKind
        // 原樣複製到新段落，不需要額外處理。
        return editor.commands.splitParagraphFresh();
      },
      Backspace: () => {
        const { editor } = this;
        const { state } = editor;
        const { selection } = state;

        // 只處理「游標是空選取」的情境；有選取範圍交給 ProseMirror 預設的刪除
        // 選取內容處理，不用管。
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.parent.type.name !== "paragraph") return false;

        // 已知 Bug 記錄第 15 項：空白的引用/清單行按 Backspace 清空文字後，
        // blockKind 屬性沒有跟著重置，畫面上還是一個空的引用/清單框，容易讓人
        // 以為「刪不掉」；接著在這個空白引用/清單行上再按一次 Backspace，會直接
        // 走 ProseMirror 對「不同 blockKind 段落合併」的預設路徑，實測結果不乾淨
        // （會刪到前一行文字、引用框卻還留著）。跟 Enter 已經有的「空白清單/引用
        // 行跳出格式」邏輯比照辦理，Backspace 也先跳出格式（變回一般段落）再讓
        // 使用者按第二次 Backspace 才真的合併——這是 Notion 等多數編輯器的標準
        // 手感，也讓後續合併邏輯吃到的是兩個 blockKind 一致（都是一般段落）的
        // 段落，不用擔心 blockKind 不一致時 merge 行為不穩定。
        //
        // 這裡的「格式」涵蓋 blockKind（引用/清單）跟 headingLevel（標題）兩種
        // 互斥屬性——Faryne 實測發現空白標題（例如打完字又刪光的 H1）按
        // Backspace 沒有這層保護，直接合併掉整個標題段落、游標跳到前一行尾端，
        // 跟空白引用/清單行「先跳出格式」的手感不一致，這裡一併補上。
        const currentBlockKind = ($from.parent.attrs.blockKind ??
          DEFAULT_BLOCK_KIND) as BlockKindValue;
        const currentHeadingLevel = ($from.parent.attrs.headingLevel ??
          DEFAULT_HEADING_LEVEL) as HeadingLevel;
        const isCurrentParagraphEmpty = $from.parent.textContent.trim() === "";
        if (
          $from.parentOffset === 0 &&
          (currentBlockKind !== DEFAULT_BLOCK_KIND ||
            currentHeadingLevel !== DEFAULT_HEADING_LEVEL) &&
          isCurrentParagraphEmpty
        ) {
          const paragraphStart = $from.before($from.depth);
          return editor.commands.command(({ tr }) => {
            tr.setNodeAttribute(
              paragraphStart,
              "blockKind",
              DEFAULT_BLOCK_KIND,
            );
            tr.setNodeAttribute(
              paragraphStart,
              "headingLevel",
              DEFAULT_HEADING_LEVEL,
            );
            return true;
          });
        }

        // 已知 Bug 記錄第 14 項：圖片（inline atom）緊接在游標前面時，按 Backspace
        // 會直接把圖片刪掉、沒有「先選取再刪除」的緩衝機會。實測（Faryne 提供的
        // debug log）發現真正的情境比原本設想的更常見：float 環繞排版時，圖片
        // 跟後面的文字其實是**同一個段落**（圖片是 inline atom，緊接著文字），不是
        // 「圖片自己獨占一個段落」——這代表游標在「圖片後文字最前面」時
        // parentOffset 是 1（緊接在圖片這個 atom 後面），不是 0。
        //
        // ProseMirror 內建的 joinBackward／selectNodeBackward 都是設計給「游標在
        // 段落最開頭（parentOffset === 0），要處理的是前一個獨立段落」這種情境，
        // 完全沒有覆蓋「游標緊接在同段落內的 atom 後面」——這個情境沒有任何 JS
        // 邏輯接手時，事件會落到瀏覽器原生的 contenteditable 行為，直接把那個
        // `contenteditable=false` 的圖片節點刪掉，完全沒有先選取的機會。
        //
        // 這裡分兩種情境找出「緊接在游標前面的 atom」。注意：ProseMirror 的
        // `node.isAtom` 定義是 `isLeaf || spec.atom`，純文字節點也是 leaf（沒有
        // 子內容），所以文字節點的 `isAtom` 也會是 `true`——不能只檢查
        // `isAtom`，一定要額外排除 `isText`，只鎖定「圖片」這種真正的自訂 atom
        // 節點，不然一般文字也會被誤判成atom整段選取，導致按一次 Backspace
        // 把整段文字都刪掉（Faryne 實測發現：引用區塊內打字，游標不在段落開頭
        // 時按 Backspace 整段文字消失，root cause 就是這個誤判）。
        let atomPos: number | null = null;
        if ($from.parentOffset > 0) {
          // 情境一：游標前面在同一個段落內就有內容——檢查緊接在前面的是不是 atom。
          const nodeBefore = $from.nodeBefore;
          if (nodeBefore && nodeBefore.isAtom && !nodeBefore.isText) {
            atomPos = $from.pos - nodeBefore.nodeSize;
          }
        } else {
          // 情境二：游標在段落最開頭——檢查「前一個段落」是不是整個只有一個 atom
          // （圖片獨占一個段落的舊排版方式，例如 block/center/全寬 layout）。
          const paragraphStart = $from.before($from.depth);
          if (paragraphStart > 0) {
            const prevNode = state.doc.resolve(paragraphStart).nodeBefore;
            const isSoleAtomParagraph =
              prevNode?.type.name === "paragraph" &&
              prevNode.childCount === 1 &&
              !!prevNode.firstChild &&
              prevNode.firstChild.isAtom &&
              !prevNode.firstChild.isText;
            if (isSoleAtomParagraph && prevNode) {
              atomPos = paragraphStart - prevNode.nodeSize + 1;
            }
          }
        }

        if (atomPos === null) return false;

        // 第一次 Backspace 只把圖片轉成 NodeSelection（反白選取，使用者看得到選到
        // 的是圖片），真的要刪除得再按一次 Backspace（那次選取狀態下的 Backspace
        // 是 ProseMirror 對 NodeSelection 的預設行為，不需要另外處理）——比照
        // Notion／Google Docs 對圖片/附件的慣例。
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) {
            tr.setSelection(NodeSelection.create(tr.doc, atomPos));
            dispatch(tr.scrollIntoView());
          }
          return true;
        });
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
