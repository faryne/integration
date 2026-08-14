import { mergeAttributes, Node } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
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

import { generateTableId, generateTableRowId } from "./whitelist";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    storytellerTable: {
      /** 插入一張真表格。UI 入口留給 Phase 3 slash command／後續 table menu 接上。 */
      insertStorytellerTable: (options?: {
        rows?: number;
        cols?: number;
      }) => ReturnType;
      addStorytellerTableRowBefore: () => ReturnType;
      addStorytellerTableRowAfter: () => ReturnType;
      deleteStorytellerTableRow: () => ReturnType;
      addStorytellerTableColumnBefore: () => ReturnType;
      addStorytellerTableColumnAfter: () => ReturnType;
      deleteStorytellerTableColumn: () => ReturnType;
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

export const StorytellerTable = Node.create({
  name: "storytellerTable",
  group: "block",
  content: "tableRow+",
  isolating: true,

  extendNodeSchema() {
    return { tableRole: "table" };
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
      addStorytellerTableRowBefore:
        () =>
        ({ state, dispatch }) =>
          addRowBefore(state, dispatch),
      addStorytellerTableRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatch),
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
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      "Shift-Tab": () =>
        goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },

  addProseMirrorPlugins() {
    return [tableEditing()];
  },
});

export const StorytellerTableRow = Node.create({
  name: "tableRow",
  content: "tableCell+",

  extendNodeSchema() {
    return { tableRole: "row" };
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

  extendNodeSchema() {
    return { tableRole: "cell" };
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
