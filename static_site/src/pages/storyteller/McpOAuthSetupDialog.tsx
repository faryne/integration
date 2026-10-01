import { Box, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import {
  mcpOAuthTools,
  oauthMcpEndpoint,
} from "@/pages/storyteller/mcpClientSetup.ts";
import {
  CopyableCode,
  ToolPicker,
} from "@/pages/storyteller/developerShared.tsx";

// MCP 連接步驟 2（OAuth）：選要連的工具，顯示 MCP 網址與該工具的設定步驟。
// OAuth 不需要在這裡建立任何東西，真正的授權發生在工具跳出的 Steamloom 授權頁。
export function McpOAuthSetupDialog({
  open,
  onClose,
  onComplete,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (toolLabel: string) => void;
  onCopy: (value: string) => void;
}) {
  const [toolKey, setToolKey] = useState(mcpOAuthTools[0].key);
  const tool =
    mcpOAuthTools.find((item) => item.key === toolKey) ?? mcpOAuthTools[0];

  return (
    <StorytellerDialog
      open={open}
      maxWidth="sm"
      eyebrow="步驟 2 · OAuth 授權"
      title="要連哪個工具？"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={() => onComplete(tool.label)}>
            完成設定
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <ToolPicker
          tools={mcpOAuthTools}
          value={toolKey}
          onChange={setToolKey}
        />
        <CopyableCode
          label="MCP 連線位址"
          value={oauthMcpEndpoint}
          onCopy={onCopy}
        />
        {tool.command && (
          <CopyableCode
            label="在終端機執行："
            value={tool.command(oauthMcpEndpoint)}
            onCopy={onCopy}
          />
        )}
        <Box
          component="ol"
          sx={{ m: 0, pl: 2.5, typography: "body2", lineHeight: 1.9 }}
        >
          {tool.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          授權完成後，可以在「開發者 › OAuth Token」管理或撤銷。
        </Typography>
      </Stack>
    </StorytellerDialog>
  );
}
