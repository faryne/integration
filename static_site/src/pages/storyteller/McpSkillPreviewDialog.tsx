import DownloadIcon from "@mui/icons-material/Download";
import { Box, Button, Typography } from "@mui/material";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { STORYTELLER_MCP_SKILL_FRONTMATTER } from "@/pages/storyteller/storytellerMcpSkillDoc.ts";

const codeBlockSx = {
  m: 0,
  p: 1.5,
  borderRadius: 1,
  bgcolor: "action.hover",
  fontSize: 12,
  overflowX: "auto",
} as const;

// MCP 連接步驟 3 的「預覽內容」：原本直接攤在頁面上的 SKILL.md 收進這裡。
// react-markdown 不認得 YAML frontmatter，所以 frontmatter 另外用 code block 呈現。
export function McpSkillPreviewDialog({
  open,
  body,
  onClose,
  onDownload,
}: {
  open: boolean;
  body: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <StorytellerDialog
      open={open}
      maxWidth="md"
      eyebrow="步驟 3 · SKILL.md 預覽"
      title="給 AI Agent 的說明文件"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>關閉</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={onDownload}
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
          {STORYTELLER_MCP_SKILL_FRONTMATTER}
        </Box>
        <StorytellerMarkdown>{body}</StorytellerMarkdown>
      </Box>
    </StorytellerDialog>
  );
}
