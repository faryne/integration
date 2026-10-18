import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 單篇的尋找／取代（編輯區右上的浮動列，見 StorytellerFindBar.tsx）。
 *
 * - 只比對看得到的正文：逐個 textblock（段落、標題、清單、表格儲存格、程式碼區塊）把文字節點
 *   接起來比對，所以可以跨粗體等 mark 的邊界；圖片等非文字行內節點當斷點，不會跨過去。
 *   註解、腳注內文、參照存在 mark 的屬性裡，本來就不是文字節點，不會被找到或換掉。
 * - 符合處用 decoration 高亮，不寫進內容；切換「目前這個」時只捲動、不動選取——
 *   格式列（bubble menu）在編輯區沒 focus 時也會因為選取文字而跳出來，會擋住畫面。
 * - 取代沿用符合處第一個字的 mark；「全部取代」是單一 transaction，⌘Z 一次還原。
 */

export type FindMatch = { from: number; to: number };

type FindState = {
  query: string;
  caseSensitive: boolean;
  matches: FindMatch[];
  current: number;
  decorations: DecorationSet;
};

type FindMeta = Partial<Pick<FindState, "query" | "caseSensitive" | "current">>;

export const findReplaceKey = new PluginKey<FindState>(
  "storytellerFindReplace",
);

/** 圖片等非文字行內節點的佔位字元，使用者輸入不會有這個字，比對不會跨過它 */
const SEPARATOR = "\u0000";

// 逐個 UTF-16 code unit 轉小寫：少數字元（例如 İ）轉完長度會變，那些保留原樣，位置才對得上
const foldCase = (text: string) =>
  Array.from({ length: text.length }, (_, i) => {
    const lower = text[i].toLowerCase();
    return lower.length === 1 ? lower : text[i];
  }).join("");

export function findMatches(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
): FindMatch[] {
  if (!query) return [];
  const needle = caseSensitive ? query : foldCase(query);
  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // positions[i]＝第 i 個字元在文件裡的位置
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        text += child.text;
        for (let i = 0; i < child.text!.length; i++) positions.push(start + i);
      } else {
        text += SEPARATOR;
        positions.push(start);
      }
    });
    const haystack = caseSensitive ? text : foldCase(text);
    for (
      let i = haystack.indexOf(needle);
      i >= 0;
      i = haystack.indexOf(needle, i + needle.length)
    ) {
      matches.push({
        from: positions[i],
        to: positions[i + needle.length - 1] + 1,
      });
    }
    return false;
  });
  return matches;
}

function buildState(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
  current: number,
): FindState {
  const matches = findMatches(doc, query, caseSensitive);
  const index = matches.length
    ? Math.min(Math.max(current, 0), matches.length - 1)
    : 0;
  return {
    query,
    caseSensitive,
    matches,
    current: index,
    decorations: DecorationSet.create(
      doc,
      matches.map((match, i) =>
        Decoration.inline(match.from, match.to, {
          class:
            i === index
              ? "wysiwyg-find-hit wysiwyg-find-hit-current"
              : "wysiwyg-find-hit",
        }),
      ),
    ),
  };
}

const EMPTY_STATE: FindState = {
  query: "",
  caseSensitive: false,
  matches: [],
  current: 0,
  decorations: DecorationSet.empty,
};

export const FindReplace = Extension.create({
  name: "storytellerFindReplace",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findReplaceKey,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, previous) {
            const meta = tr.getMeta(findReplaceKey) as FindMeta | undefined;
            // 查詢條件變了，或是開著搜尋時內容變了（作者邊找邊改）：重新比對
            if (!meta && !(tr.docChanged && previous.query)) return previous;
            const next = { ...previous, ...meta };
            return next.query
              ? buildState(tr.doc, next.query, next.caseSensitive, next.current)
              : EMPTY_STATE;
          },
        },
        props: {
          decorations: (state) => findReplaceKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

export const getFindState = (editor: Editor) =>
  findReplaceKey.getState(editor.state) ?? EMPTY_STATE;

// 把目前這個符合處捲到畫面中間；decoration 在 dispatch 時就已經畫好
function revealCurrent(editor: Editor) {
  editor.view.dom
    .querySelector(".wysiwyg-find-hit-current")
    ?.scrollIntoView?.({ block: "center" });
}

function dispatchFind(editor: Editor, meta: FindMeta) {
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, meta));
  revealCurrent(editor);
}

/** 更新查詢；從游標位置之後的第一個符合處開始 */
export function setFindQuery(
  editor: Editor,
  query: string,
  caseSensitive: boolean,
) {
  const matches = findMatches(editor.state.doc, query, caseSensitive);
  const after = matches.findIndex(
    (match) => match.from >= editor.state.selection.from,
  );
  dispatchFind(editor, { query, caseSensitive, current: Math.max(after, 0) });
}

/** 上一個／下一個，頭尾循環 */
export function stepFindMatch(editor: Editor, delta: 1 | -1) {
  const { matches, current } = getFindState(editor);
  if (!matches.length) return;
  dispatchFind(editor, {
    current: (current + delta + matches.length) % matches.length,
  });
}

/** 關掉搜尋：清掉高亮，游標放到目前這個符合處的結尾 */
export function clearFind(editor: Editor) {
  const { matches, current } = getFindState(editor);
  const match = matches[current];
  const tr = editor.state.tr.setMeta(findReplaceKey, { query: "" });
  if (match) tr.setSelection(TextSelection.create(tr.doc, match.to));
  editor.view.dispatch(tr);
}

// 換掉一個符合處：沿用第一個字的 mark（粗體、顏色、連結、註解…），空字串＝刪掉
function replaceRange(
  editor: Editor,
  tr: Transaction,
  match: FindMatch,
  replacement: string,
) {
  if (!replacement) return tr.delete(match.from, match.to);
  const marks = tr.doc.nodeAt(match.from)?.marks ?? [];
  return tr.replaceWith(
    match.from,
    match.to,
    editor.schema.text(replacement, marks),
  );
}

/** 取代目前這個，接著跳到它後面的下一個（取代字串裡含查詢字時不會原地打轉） */
export function replaceCurrentMatch(editor: Editor, replacement: string) {
  const { matches, current } = getFindState(editor);
  const match = matches[current];
  if (!match) return;
  const tr = replaceRange(editor, editor.state.tr, match, replacement);
  const nextFrom = match.from + replacement.length;
  const { query, caseSensitive } = getFindState(editor);
  const after = findMatches(tr.doc, query, caseSensitive).findIndex(
    (next) => next.from >= nextFrom,
  );
  editor.view.dispatch(
    tr.setMeta(findReplaceKey, { current: Math.max(after, 0) }),
  );
  revealCurrent(editor);
}

/** 全部取代，回傳取代了幾處 */
export function replaceAllMatches(editor: Editor, replacement: string) {
  const { matches } = getFindState(editor);
  if (!matches.length) return 0;
  const tr = editor.state.tr;
  // 從後面換回來，前面的位置才不會被位移
  for (const match of [...matches].reverse()) {
    replaceRange(editor, tr, match, replacement);
  }
  editor.view.dispatch(tr.setMeta(findReplaceKey, { current: 0 }));
  return matches.length;
}
