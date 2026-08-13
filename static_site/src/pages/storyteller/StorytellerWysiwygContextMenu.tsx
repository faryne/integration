import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Editor } from "@tiptap/core";

import {
  wysiwygCommandsByGroup,
  type WysiwygCommandContext,
} from "./wysiwygCore/commands";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface StorytellerWysiwygContextMenuProps {
  editor: Editor;
  position: ContextMenuPosition | null;
  onClose: () => void;
  commandContext: WysiwygCommandContext;
  /** 腳注／註解的「快速移除」是右鍵選單獨有的捷徑（工具列沒有對應按鈕，只能透過對話框
   * 本身的「移除」按鈕），command registry 沒有涵蓋，維持獨立傳入。 */
  onRemoveFootnote: () => void;
  onRemoveComment: () => void;
  hasFootnote: boolean;
  hasComment: boolean;
}

/**
 * 右鍵選單：Phase 1 只把既有動作改成消費 Command Registry（wysiwygCore/commands.ts），
 * UX 不變——依然是固定清單，不論游標在哪都顯示同一批行內樣式項目。「依 selection 狀態
 * 分情境顯示不同內容」是 Phase 2 的工作，不在這裡做。
 */
export function StorytellerWysiwygContextMenu({
  editor,
  position,
  onClose,
  commandContext,
  onRemoveFootnote,
  onRemoveComment,
  hasFootnote,
  hasComment,
}: StorytellerWysiwygContextMenuProps) {
  const runAndClose = (command: {
    run: (editor: Editor, context: WysiwygCommandContext) => void;
  }) => {
    command.run(editor, commandContext);
    onClose();
  };

  const textColorCommands = wysiwygCommandsByGroup("color").filter((c) =>
    c.id.startsWith("text-color-"),
  );
  const bgColorCommands = wysiwygCommandsByGroup("color").filter((c) =>
    c.id.startsWith("bg-color-"),
  );
  const annotationCommands = wysiwygCommandsByGroup("annotation").filter(
    (command) => command.isVisible?.(commandContext) ?? true,
  );

  return (
    <Menu
      open={position !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position ? { top: position.y, left: position.x } : undefined
      }
    >
      {wysiwygCommandsByGroup("mark").map((command) => {
        const Icon = command.icon!;
        return (
          <MenuItem
            key={command.id}
            selected={command.isActive?.(editor) ?? false}
            onClick={() => runAndClose(command)}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{command.label}</ListItemText>
          </MenuItem>
        );
      })}

      <Divider />

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 2, pt: 1 }}
      >
        文字顏色
      </Typography>
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1 }}>
        {textColorCommands
          .filter((c) => c.id !== "text-color-clear")
          .map((command) => (
            <Tooltip key={command.id} title={command.label}>
              <Box
                component="button"
                type="button"
                aria-label={command.label}
                aria-pressed={command.isActive?.(editor) ?? false}
                onClick={() => runAndClose(command)}
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor: command.isActive?.(editor)
                    ? "text.primary"
                    : "divider",
                  bgcolor: command.previewColor,
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
      </Stack>
      <MenuItem
        onClick={() => runAndClose(getColorClearCommand(textColorCommands))}
      >
        <ListItemIcon>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>清除文字顏色</ListItemText>
      </MenuItem>

      <Divider />

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 2, pt: 1 }}
      >
        文字背景色
      </Typography>
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1 }}>
        {bgColorCommands
          .filter((c) => c.id !== "bg-color-clear")
          .map((command) => (
            <Tooltip key={command.id} title={command.label}>
              <Box
                component="button"
                type="button"
                aria-label={command.label}
                aria-pressed={command.isActive?.(editor) ?? false}
                onClick={() => runAndClose(command)}
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor: command.isActive?.(editor)
                    ? "text.primary"
                    : "divider",
                  bgcolor: command.previewColor,
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
      </Stack>
      <MenuItem onClick={() => runAndClose(getColorClearCommand(bgColorCommands))}>
        <ListItemIcon>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>清除背景色</ListItemText>
      </MenuItem>

      <Divider />

      {annotationCommands.map((command, index) => {
        const Icon = command.icon!;
        const isActive = command.isActive?.(editor) ?? false;
        const label =
          isActive && command.activeLabel ? command.activeLabel : command.label;
        const isEnabled = command.isEnabled?.(editor, commandContext) ?? true;
        const quickRemove =
          command.id === "footnote" && hasFootnote ? (
            <MenuItem
              onClick={() => {
                onClose();
                onRemoveFootnote();
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>移除腳注</ListItemText>
            </MenuItem>
          ) : command.id === "comment" && hasComment ? (
            <MenuItem
              onClick={() => {
                onClose();
                onRemoveComment();
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>移除註解</ListItemText>
            </MenuItem>
          ) : null;
        return (
          <Box key={command.id}>
            {index > 0 && <Divider />}
            <MenuItem
              disabled={!isEnabled}
              onClick={() => runAndClose(command)}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </MenuItem>
            {quickRemove}
          </Box>
        );
      })}
    </Menu>
  );
}

function getColorClearCommand(
  commands: ReturnType<typeof wysiwygCommandsByGroup>,
) {
  const clear = commands.find((c) => c.id.endsWith("-clear"));
  if (!clear) {
    throw new Error("color clear command not found in registry");
  }
  return clear;
}
