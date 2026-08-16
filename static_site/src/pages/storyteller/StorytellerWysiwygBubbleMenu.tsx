import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Divider, Paper, Stack, Tooltip } from "@mui/material";
import { isTextSelection, type Editor } from "@tiptap/core";
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

const BUBBLE_MARK_IDS = [
  "bold",
  "italic",
  "underline",
  "subscript",
  "superscript",
  "strike",
];

/**
 * Bubble Menu（Phase 4）：選取文字時顯示的浮動小工具列，是拔工具列後的可發現性補償
 * （見定案文件風險清單第 3 點）。涵蓋常用行內樣式（粗體/斜體/底線/下標/上標/刪除線/
 * 文字色/連結/註解/腳注）；背景色空間有限、且使用頻率低於前景色，仍只在右鍵選單/
 * 工具列提供。
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
  // text-color-clear 的 id 也是 "text-color-" 開頭，但它是「清除顏色」的動作，不是
  // 色票（沒有 previewColor），要排除掉才不會在色票列裡多一顆空白按鈕；清除功能另外
  // 用固定的 DeleteIcon 按鈕呈現（見下面 JSX）。
  const textColorCommands = wysiwygCommandsByGroup("color").filter(
    (command) => command.id.startsWith("text-color-") && command.id !== "text-color-clear",
  );
  const linkCommand = getWysiwygCommand("link")!;
  const footnoteCommand = getWysiwygCommand("footnote")!;
  const commentCommand = getWysiwygCommand("comment")!;
  const LinkIcon = linkCommand.icon!;
  const FootnoteIcon = footnoteCommand.icon!;
  const CommentIcon = commentCommand.icon!;

  const run = (command: {
    run: (editor: Editor, context: WysiwygCommandContext) => void;
  }) => command.run(editor, commandContext);

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state, from, to }) => {
        const { selection } = state;
        // 官方預設 shouldShow 只排除空選取／空文字區塊，沒有排除 NodeSelection
        // （例如選到 assetImage 這種 atom node）——這裡額外要求是真正的
        // TextSelection、且選取範圍內有非空白文字，符合「選取文字時顯示」的規格，
        // 不是「任何非空 selection 都顯示」。
        return (
          isTextSelection(selection) &&
          !selection.empty &&
          state.doc.textBetween(from, to).trim().length > 0
        );
      }}
    >
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

          {(footnoteCommand.isVisible?.(commandContext) ?? true) && (
            <Tooltip
              title={
                footnoteCommand.isActive?.(editor) ? "編輯腳注" : "加腳注"
              }
            >
              <Box
                component="button"
                type="button"
                aria-label="腳注"
                aria-pressed={footnoteCommand.isActive?.(editor) ?? false}
                onClick={() => run(footnoteCommand)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  border: "none",
                  borderRadius: 1,
                  cursor: "pointer",
                  bgcolor: footnoteCommand.isActive?.(editor)
                    ? "action.selected"
                    : "transparent",
                  color: "text.primary",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <FootnoteIcon fontSize="small" />
              </Box>
            </Tooltip>
          )}

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
