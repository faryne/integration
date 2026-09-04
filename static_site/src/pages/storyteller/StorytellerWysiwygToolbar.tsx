import { Box, Divider, IconButton, Paper, Tooltip } from "@mui/material";
import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";

import { StorytellerWysiwygSyntaxDrawer } from "./StorytellerWysiwygSyntaxDrawer";
import {
  wysiwygCommandsByGroup,
  type WysiwygCommandContext,
} from "./wysiwygCore/commands";

export type StorytellerWysiwygFeature = "footnote" | "comment" | "asset";

interface StorytellerWysiwygToolbarProps {
  editor: Editor;
  commandContext: WysiwygCommandContext;
  enabledFeatures?: StorytellerWysiwygFeature[];
  toolbarExtra?: ReactNode;
  placement?: "top" | "bottom";
}

// 文件層級工具列只保留「整份文件」相關操作；行內格式主要交給 bubble menu / slash command。
// 順序（2026-09-04 使用者定案）：呼叫端組好的 toolbarExtra（插入資產／大綱與書籤／
// 編輯歷史／AI 助理，寫作時常用）排最前面；語法說明／匯出 markdown 這類查閱/偶爾用的
// 動作排在後面、靠近存檔按鈕。
export function StorytellerWysiwygToolbar({
  editor,
  commandContext,
  enabledFeatures,
  toolbarExtra,
  placement = "top",
}: StorytellerWysiwygToolbarProps) {
  const utilityCommands = wysiwygCommandsByGroup("utility").filter(
    (command) => command.isVisible?.(commandContext) ?? true,
  );

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 1,
        mt: placement === "bottom" ? 0.5 : 0,
        mb: placement === "top" ? 0.5 : 0,
        minWidth: 0,
        maxWidth: 1,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0.5,
          px: 0.75,
          py: 0.5,
          maxWidth: 1,
          borderColor: "transparent",
          bgcolor: "transparent",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "&:hover": {
            borderColor: "divider",
            bgcolor: "action.hover",
          },
        }}
      >
        {toolbarExtra && (
          <>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {toolbarExtra}
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          </>
        )}
        {utilityCommands.map((command) => {
          const Icon = command.icon!;
          return (
            <Tooltip key={command.id} title={command.label}>
              <IconButton
                aria-label={command.label}
                size="small"
                onClick={() => command.run(editor, commandContext)}
              >
                <Icon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        })}
        <StorytellerWysiwygSyntaxDrawer enabledFeatures={enabledFeatures} />
      </Paper>
    </Box>
  );
}
