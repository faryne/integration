import { mergeAttributes, Node } from "@tiptap/core";
import {
  Fragment,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  goToNextCell,
  tableEditing,
} from "@tiptap/pm/tables";

import {
  generateMarkerId,
  generateTableId,
  generateTableRowId,
} from "./whitelist";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    storytellerTable: {
      /** 插入一張真表格。UI 入口留給 Phase 3 slash command／後續 table menu 接上。 */
      insertStorytellerTable: (options?: {
        rows?: number;
        cols?: number;
      }) => ReturnType;
      /** 將游標所在的連續舊 table-row 段落手動轉成真表格；不做靜默自動轉換。 */
      convertLegacyTableRowsToStorytellerTable: () => ReturnType;
      addStorytellerTableRowBefore: () => ReturnType;
      addStorytellerTableRowAfter: () => ReturnType;
      deleteStorytellerTableRow: () => ReturnType;
      addStorytellerTableColumnBefore: () => ReturnType;
      addStorytellerTableColumnAfter: () => ReturnType;
      deleteStorytellerTableColumn: () => ReturnType;
      /** 刪除游標所在的整張表格（不是單一列/欄），跟 deleteStorytellerTableRow/Column 分開。 */
      deleteStorytellerTable: () => ReturnType;
    };
  }
}

function createTableCell(schema: Schema) {
  return schema.nodes.tableCell.createAndFill()!;
}

function createTableRow(schema: Schema, cols: number) {
  const cells = Array.from({ length: cols }, () => createTableCell(schema));
  return schema.nodes.tableRow.create({ rowId: generateTableRowId() }, cells);
}

function tableRoleForSelf(
  extension: { name: string },
  selfName: string,
  tableRole: "table" | "row" | "cell",
) {
  return extension.name === selfName ? { tableRole } : {};
}

function topLevelNodeStart(doc: ProseMirrorNode, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

function isLegacyTableRow(node: ProseMirrorNode) {
  return node.type.name === "paragraph" && node.attrs.blockKind === "table-row";
}

function isBlankLegacyCell(nodes: ProseMirrorNode[]) {
  return nodes.every((node) => node.isText && (node.text ?? "").trim() === "");
}

function splitLegacyTableRowCells(row: ProseMirrorNode) {
  const cells: ProseMirrorNode[][] = [[]];
  row.content.forEach((child) => {
    if (!child.isText || !child.text?.includes("|")) {
      cells[cells.length - 1].push(child);
      return;
    }
    child.text.split("|").forEach((piece, index) => {
      if (index > 0) cells.push([]);
      if (piece !== "") {
        cells[cells.length - 1].push(row.type.schema.text(piece, child.marks));
      }
    });
  });
  if (cells.length > 1 && isBlankLegacyCell(cells[0])) cells.shift();
  if (cells.length > 1 && isBlankLegacyCell(cells[cells.length - 1])) {
    cells.pop();
  }
  return cells;
}

function createTableRowFromLegacy(
  schema: Schema,
  cellContents: ProseMirrorNode[][],
  columnCount: number,
) {
  const cells = Array.from({ length: columnCount }, (_, index) =>
    schema.nodes.tableCell.create(
      null,
      Fragment.fromArray(cellContents[index] ?? []),
    ),
  );
  return schema.nodes.tableRow.create({ rowId: generateTableRowId() }, cells);
}

function fillMissingTableRowIds(tr: Transaction) {
  const updates: number[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name === "tableRow" && !node.attrs.rowId) updates.push(pos);
  });
  updates.forEach((pos) => {
    const row = tr.doc.nodeAt(pos);
    if (row) {
      tr.setNodeMarkup(pos, undefined, {
        ...row.attrs,
        rowId: generateTableRowId(),
      });
    }
  });
  return tr;
}

function dispatchWithStableRowIds(
  dispatch: ((tr: Transaction) => void) | undefined,
) {
  return dispatch
    ? (tr: Transaction) => dispatch(fillMissingTableRowIds(tr))
    : undefined;
}

export const StorytellerTable = Node.create({
  name: "storytellerTable",
  group: "block",
  content: "tableRow+",
  isolating: true,

  extendNodeSchema(extension) {
    return tableRoleForSelf(extension, "storytellerTable", "table");
  },

  addAttributes() {
    return {
      tableId: { default: null as string | null },
    };
  },

  parseHTML() {
    return [{ tag: "table[data-storyteller-table]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "table",
      mergeAttributes(HTMLAttributes, {
        "data-storyteller-table": "",
        "data-table-id": node.attrs.tableId ?? "",
      }),
      ["tbody", 0],
    ];
  },

  addCommands() {
    return {
      insertStorytellerTable:
        (options) =>
        ({ state, dispatch }) => {
          const rows = Math.max(1, options?.rows ?? 3);
          const cols = Math.max(1, options?.cols ?? 3);
          const table = state.schema.nodes.storytellerTable.create(
            { tableId: generateTableId() },
            Array.from({ length: rows }, () =>
              createTableRow(state.schema, cols),
            ),
          );
          if (dispatch) {
            const tr = state.tr.replaceSelectionWith(table).scrollIntoView();
            const firstCellPos = tr.selection.from + 3;
            tr.setSelection(TextSelection.near(tr.doc.resolve(firstCellPos)));
            dispatch(tr);
          }
          return true;
        },
      convertLegacyTableRowsToStorytellerTable:
        () =>
        ({ state, dispatch }) => {
          const currentIndex = state.selection.$from.index(0);
          if (currentIndex >= state.doc.childCount) return false;
          if (!isLegacyTableRow(state.doc.child(currentIndex))) return false;

          let fromIndex = currentIndex;
          while (
            fromIndex > 0 &&
            isLegacyTableRow(state.doc.child(fromIndex - 1))
          ) {
            fromIndex--;
          }

          let toIndex = currentIndex;
          while (
            toIndex < state.doc.childCount - 1 &&
            isLegacyTableRow(state.doc.child(toIndex + 1))
          ) {
            toIndex++;
          }

          const from = topLevelNodeStart(state.doc, fromIndex);
          const to =
            topLevelNodeStart(state.doc, toIndex) +
            state.doc.child(toIndex).nodeSize;
          const legacyRows = Array.from(
            { length: toIndex - fromIndex + 1 },
            (_, i) => splitLegacyTableRowCells(state.doc.child(fromIndex + i)),
          );
          const columnCount = Math.max(
            1,
            ...legacyRows.map((row) => row.length),
          );
          const rows = legacyRows.map((row) =>
            createTableRowFromLegacy(state.schema, row, columnCount),
          );
          const table = state.schema.nodes.storytellerTable.create(
            { tableId: generateTableId() },
            rows,
          );
          if (dispatch) {
            const tr = state.tr.replaceWith(from, to, table).scrollIntoView();
            tr.setSelection(TextSelection.near(tr.doc.resolve(from + 3)));
            dispatch(tr);
          }
          return true;
        },
      addStorytellerTableRowBefore:
        () =>
        ({ state, dispatch }) =>
          addRowBefore(state, dispatchWithStableRowIds(dispatch)),
      addStorytellerTableRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatchWithStableRowIds(dispatch)),
      deleteStorytellerTableRow:
        () =>
        ({ state, dispatch }) =>
          deleteRow(state, dispatch),
      addStorytellerTableColumnBefore:
        () =>
        ({ state, dispatch }) =>
          addColumnBefore(state, dispatch),
      addStorytellerTableColumnAfter:
        () =>
        ({ state, dispatch }) =>
          addColumnAfter(state, dispatch),
      deleteStorytellerTableColumn:
        () =>
        ({ state, dispatch }) =>
          deleteColumn(state, dispatch),
      deleteStorytellerTable:
        () =>
        ({ state, dispatch }) => {
          const tableIndex = state.selection.$from.index(0);
          if (tableIndex >= state.doc.childCount) return false;
          if (state.doc.child(tableIndex).type.name !== "storytellerTable") {
            return false;
          }
          const from = topLevelNodeStart(state.doc, tableIndex);
          const to = from + state.doc.child(tableIndex).nodeSize;
          if (dispatch) {
            // Document 的 content 是 `block+`，整份文件不能空——如果表格是唯一內容，
            // 刪掉後補一個空段落，避免違反 schema。
            const isOnlyContent = state.doc.childCount === 1;
            const tr = isOnlyContent
              ? state.tr.replaceWith(
                  from,
                  to,
                  state.schema.nodes.paragraph.create({
                    markerId: generateMarkerId(),
                  }),
                )
              : state.tr.delete(from, to);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    // IME 組字期間按 Tab 不能跳 cell——組字中的文字還沒真正寫進文件，一旦切換 cell
    // (ProseMirror selection 換節點) 會直接打斷 compositionend、弄丟正在輸入的字，
    // 使用者實測發現這個問題（Phase 9.1 案例 3）。回傳 false 讓瀏覽器/輸入法自己
    // 處理這次 Tab，不要搶在組字完成前跳走。
    return {
      Tab: () =>
        this.editor.view.composing
          ? false
          : goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      "Shift-Tab": () =>
        this.editor.view.composing
          ? false
          : goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },

  addProseMirrorPlugins() {
    return [tableEditing()];
  },
});

export const StorytellerTableRow = Node.create({
  name: "tableRow",
  content: "tableCell+",

  extendNodeSchema(extension) {
    return tableRoleForSelf(extension, "tableRow", "row");
  },

  addAttributes() {
    return {
      rowId: { default: null as string | null },
    };
  },

  parseHTML() {
    return [{ tag: "tr" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "tr",
      mergeAttributes(HTMLAttributes, {
        "data-row-id": node.attrs.rowId ?? "",
      }),
      0,
    ];
  },
});

export const StorytellerTableCell = Node.create({
  name: "tableCell",
  content: "inline*",
  isolating: true,

  extendNodeSchema(extension) {
    return tableRoleForSelf(extension, "tableCell", "cell");
  },

  addAttributes() {
    return {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null as number[] | null },
    };
  },

  parseHTML() {
    return [{ tag: "td" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});
