import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Button, Divider, Paper, Stack } from "@mui/material";
import { isTextSelection, type Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";

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
            上方列
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
            下方列
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
            刪除列
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
            左側欄
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
            右側欄
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
            刪除欄
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
            刪除表格
          </Button>
        </Stack>
      </Paper>
    </BubbleMenu>
  );
}
