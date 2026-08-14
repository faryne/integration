import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Divider, Paper, Stack, Tooltip } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useState } from "react";

import {
  getWysiwygCommand,
  wysiwygCommandsByGroup,
  type WysiwygCommandContext,
} from "./wysiwygCore/commands";

interface StorytellerWysiwygBubbleMenuProps {
  editor: Editor;
  commandContext: WysiwygCommandContext;
}

const BUBBLE_MARK_IDS = ["bold", "italic", "underline"];

/**
 * Bubble Menu（Phase 4）：選取文字時顯示的浮動小工具列，是拔工具列後的可發現性補償
 * （見定案文件風險清單第 3 點）。只收斂最常用的行內樣式，不是右鍵選單的縮小版——
 * 完整功能（下標/上標/刪除線/背景色/腳注等）還是要靠右鍵選單或工具列。
 *
 * 跟右鍵選單一樣消費同一份 command registry，不重新定義任何動作。
 */
export function StorytellerWysiwygBubbleMenu({
  editor,
  commandContext,
}: StorytellerWysiwygBubbleMenuProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  const markCommands = wysiwygCommandsByGroup("mark").filter((command) =>
    BUBBLE_MARK_IDS.includes(command.id),
  );
  const textColorCommands = wysiwygCommandsByGroup("color").filter(
    (command) => command.id.startsWith("text-color-"),
  );
  const linkCommand = getWysiwygCommand("link")!;
  const commentCommand = getWysiwygCommand("comment")!;
  const LinkIcon = linkCommand.icon!;
  const CommentIcon = commentCommand.icon!;

  const run = (command: {
    run: (editor: Editor, context: WysiwygCommandContext) => void;
  }) => command.run(editor, commandContext);

  return (
    <BubbleMenu editor={editor}>
      <Paper
        elevation={4}
        sx={{ display: "flex", alignItems: "center", px: 0.5, py: 0.5 }}
      >
        <Stack direction="row" spacing={0.25} alignItems="center">
          {markCommands.map((command) => {
            const Icon = command.icon!;
            return (
              <Tooltip key={command.id} title={command.label}>
                <Box
                  component="button"
                  type="button"
                  aria-label={command.label}
                  aria-pressed={command.isActive?.(editor) ?? false}
                  onClick={() => run(command)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    border: "none",
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor: command.isActive?.(editor)
                      ? "action.selected"
                      : "transparent",
                    color: "text.primary",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
              </Tooltip>
            );
          })}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />

          <Box sx={{ position: "relative" }}>
            <Tooltip title="文字顏色">
              <Box
                component="button"
                type="button"
                aria-label="文字顏色"
                onClick={() => setColorMenuOpen((open) => !open)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  border: "none",
                  borderRadius: 1,
                  cursor: "pointer",
                  bgcolor: colorMenuOpen ? "action.selected" : "transparent",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid",
                    borderColor: "divider",
                    bgcolor:
                      textColorCommands.find((c) => c.isActive?.(editor))
                        ?.previewColor ?? "text.primary",
                  }}
                />
              </Box>
            </Tooltip>
            {colorMenuOpen && (
              <Paper
                elevation={4}
                sx={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  mt: 0.5,
                  p: 1,
                  zIndex: 1,
                  whiteSpace: "nowrap",
                }}
              >
                <Stack direction="row" spacing={1}>
                  {textColorCommands.map((command) => (
                    <Tooltip key={command.id} title={command.label}>
                      <Box
                        component="button"
                        type="button"
                        aria-label={command.label}
                        aria-pressed={command.isActive?.(editor) ?? false}
                        onClick={() => {
                          run(command);
                          setColorMenuOpen(false);
                        }}
                        sx={{
                          width: 20,
                          height: 20,
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
                  <Tooltip title="清除文字顏色">
                    <Box
                      component="button"
                      type="button"
                      aria-label="清除文字顏色"
                      onClick={() => {
                        run(getWysiwygCommand("text-color-clear")!);
                        setColorMenuOpen(false);
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 20,
                        height: 20,
                        border: "none",
                        cursor: "pointer",
                        bgcolor: "transparent",
                      }}
                    >
                      <DeleteIcon fontSize="inherit" />
                    </Box>
                  </Tooltip>
                </Stack>
              </Paper>
            )}
          </Box>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />

          <Tooltip title={linkCommand.isActive?.(editor) ? "編輯連結" : "加連結"}>
            <Box
              component="button"
              type="button"
              aria-label="連結"
              aria-pressed={linkCommand.isActive?.(editor) ?? false}
              onClick={() => run(linkCommand)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                border: "none",
                borderRadius: 1,
                cursor: "pointer",
                bgcolor: linkCommand.isActive?.(editor)
                  ? "action.selected"
                  : "transparent",
                color: "text.primary",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <LinkIcon fontSize="small" />
            </Box>
          </Tooltip>

          {(commentCommand.isVisible?.(commandContext) ?? true) && (
            <Tooltip
              title={commentCommand.isActive?.(editor) ? "編輯註解" : "加註解"}
            >
              <Box
                component="button"
                type="button"
                aria-label="註解"
                aria-pressed={commentCommand.isActive?.(editor) ?? false}
                onClick={() => run(commentCommand)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  border: "none",
                  borderRadius: 1,
                  cursor: "pointer",
                  bgcolor: commentCommand.isActive?.(editor)
                    ? "action.selected"
                    : "transparent",
                  color: "text.primary",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <CommentIcon fontSize="small" />
              </Box>
            </Tooltip>
          )}
        </Stack>
      </Paper>
    </BubbleMenu>
  );
}
