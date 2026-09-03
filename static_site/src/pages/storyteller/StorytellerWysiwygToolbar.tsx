import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
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
  toolbarStart?: ReactNode;
  toolbarExtra?: ReactNode;
  placement?: "top" | "bottom";
  writingBookmark?: {
    visible: boolean;
    bookmarked: boolean;
    disabled?: boolean;
    onClick: () => void;
  };
}

// 文件層級工具列只保留「整份文件」相關操作；行內格式主要交給 bubble menu / slash command。
export function StorytellerWysiwygToolbar({
  editor,
  commandContext,
  enabledFeatures,
  toolbarStart,
  toolbarExtra,
  placement = "top",
  writingBookmark,
}: StorytellerWysiwygToolbarProps) {
  const utilityCommands = wysiwygCommandsByGroup("utility").filter(
    (command) => command.isVisible?.(commandContext) ?? true,
  );
  const bookmarkLabel = writingBookmark?.bookmarked ? "移除書籤" : "加入書籤";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: toolbarStart ? "space-between" : "flex-end",
        alignItems: "center",
        gap: 1,
        mt: placement === "bottom" ? 0.5 : 0,
        mb: placement === "top" ? 0.5 : 0,
        minWidth: 0,
        maxWidth: 1,
      }}
    >
      {toolbarStart && (
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {toolbarStart}
        </Box>
      )}
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
        {writingBookmark?.visible && (
          <Tooltip
            title={
              writingBookmark.disabled ? "先存檔後才能加入書籤" : bookmarkLabel
            }
          >
            <span>
              <IconButton
                aria-label={bookmarkLabel}
                size="small"
                disabled={writingBookmark.disabled}
                color={writingBookmark.bookmarked ? "warning" : "default"}
                onClick={writingBookmark.onClick}
              >
                {writingBookmark.bookmarked ? (
                  <BookmarkIcon fontSize="small" />
                ) : (
                  <BookmarkBorderIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
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
