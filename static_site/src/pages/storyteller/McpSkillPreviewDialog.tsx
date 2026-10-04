import DownloadIcon from "@mui/icons-material/Download";
import { Box, Button, Typography } from "@mui/material";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { mcpSkillMarkdownUrl } from "@/pages/storyteller/mcpClientSetup.ts";

const codeBlockSx = {
  m: 0,
  p: 1.5,
  borderRadius: 1,
  bgcolor: "action.hover",
  fontSize: 12,
  overflowX: "auto",
} as const;

// MCP 連接步驟 4 的「預覽內容」：內容來自後端 GET /storyteller/mcp/skill.md。
// react-markdown 不認得 YAML frontmatter，所以 frontmatter 另外用 code block 呈現。
export function McpSkillPreviewDialog({
  open,
  frontmatter,
  body,
  version,
  onClose,
}: {
  open: boolean;
  frontmatter: string;
  body: string;
  version: string;
  onClose: () => void;
}) {
  return (
    <StorytellerDialog
      open={open}
      maxWidth="md"
      eyebrow={`SKILL.md 預覽${version ? ` · v${version}` : ""}`}
      title="給 AI 的寫作與操作指南"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>關閉</Button>
          <Button
            component="a"
            href={mcpSkillMarkdownUrl}
            variant="contained"
            startIcon={<DownloadIcon />}
          >
            下載 SKILL.md
          </Button>
        </>
      }
    >
      <Box
        sx={{
          maxHeight: { xs: 360, md: 480 },
          overflowY: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.default",
          p: { xs: 1.5, md: 2 },
          "& pre": codeBlockSx,
          "& code": { fontFamily: "monospace" },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5 }}
        >
          Frontmatter
        </Typography>
        <Box component="pre" sx={{ ...codeBlockSx, mb: 2 }}>
          {frontmatter}
        </Box>
        <StorytellerMarkdown>{body}</StorytellerMarkdown>
      </Box>
    </StorytellerDialog>
  );
}
