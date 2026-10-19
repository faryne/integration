import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Button, Divider, Paper, Stack } from "@mui/material";
import { isTextSelection, type Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useTranslation } from "react-i18next";

interface StorytellerWysiwygTableMenuProps {
  editor: Editor;
}

/**
 * 真表格的浮動操作入口（Phase 5）：游標在 table cell 內時提供列/欄新增刪除。
 * 這裡只接已存在的 storytellerTable core commands，不重新實作 table mutation。
 */
export function StorytellerWysiwygTableMenu({
  editor,
}: StorytellerWysiwygTableMenuProps) {
  const { t } = useTranslation();
  const run = (command: () => boolean) => command();

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state }) =>
        editor.isActive("storytellerTable") &&
        (!isTextSelection(state.selection) || state.selection.empty)
      }
    >
      <Paper
        elevation={4}
        onMouseDown={(event) => event.preventDefault()}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 0.75,
          py: 0.5,
          // Phase C：跟 Bubble menu 一樣明講吃 editorMenu token，統一浮動
          // 選單的層次（見 StorytellerWysiwygBubbleMenu.tsx 同樣的註解）。
          bgcolor: "var(--storyteller-editor-menu)",
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor.chain().focus().addStorytellerTableRowBefore().run(),
              )
            }
          >
            {t("writer:editor.table.rowAbove")}
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor.chain().focus().addStorytellerTableRowAfter().run(),
              )
            }
          >
            {t("writer:editor.table.rowBelow")}
          </Button>
          <Button
            color="error"
            size="small"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor.chain().focus().deleteStorytellerTableRow().run(),
              )
            }
          >
            {t("writer:editor.table.deleteRow")}
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor
                  .chain()
                  .focus()
                  .addStorytellerTableColumnBefore()
                  .run(),
              )
            }
          >
            {t("writer:editor.table.columnLeft")}
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor.chain().focus().addStorytellerTableColumnAfter().run(),
              )
            }
          >
            {t("writer:editor.table.columnRight")}
          </Button>
          <Button
            color="error"
            size="small"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={() =>
              run(() =>
                editor.chain().focus().deleteStorytellerTableColumn().run(),
              )
            }
          >
            {t("writer:editor.table.deleteColumn")}
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          <Button
            color="error"
            size="small"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={() =>
              run(() => editor.chain().focus().deleteStorytellerTable().run())
            }
          >
            {t("writer:editor.table.deleteTable")}
          </Button>
        </Stack>
      </Paper>
    </BubbleMenu>
  );
}
