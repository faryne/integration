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
}

// 文件層級工具列只保留「整份文件」相關操作；行內格式主要交給 bubble menu / slash command。
export function StorytellerWysiwygToolbar({
  editor,
  commandContext,
  enabledFeatures,
  toolbarExtra,
}: StorytellerWysiwygToolbarProps) {
  const utilityCommands = wysiwygCommandsByGroup("utility").filter(
    (command) => command.isVisible?.(commandContext) ?? true,
  );

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
      <Paper
        variant="outlined"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.75,
          py: 0.5,
          borderColor: "transparent",
          bgcolor: "transparent",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "&:hover": {
            borderColor: "divider",
            bgcolor: "action.hover",
          },
        }}
      >
        <StorytellerWysiwygSyntaxDrawer enabledFeatures={enabledFeatures} />
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
        {toolbarExtra && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {toolbarExtra}
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
