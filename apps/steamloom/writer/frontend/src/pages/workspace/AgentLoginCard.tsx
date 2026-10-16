import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { errorMessage } from "@writer/lib/backend.ts";

// Writer 不管理 Agent 與 MCP 憑證，只提供可以在 Terminal 自行執行的指令。
// kind 區分「Agent 本身要重新登入」與「SteamLoom MCP 要重新授權」，兩者的說明不同。
export function AgentLoginCard({ commands, kind = "agent" }: { commands: string[]; kind?: "agent" | "mcp" }) {
  const textKey = kind === "mcp" ? "workspace.chat.mcpLogin" : "workspace.chat.login";
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commands.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  return (
    <Box sx={{ mt: 1, p: 1.25, border: 1, borderColor: "warning.main", borderRadius: 1.5, bgcolor: "background.default" }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <TerminalIcon sx={{ fontSize: 18, color: "warning.main" }} />
        <Typography fontWeight={700} sx={{ flex: 1, fontSize: 13 }}>{t(`${textKey}.title`)}</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 12.5 }}>{t(`${textKey}.description`)}</Typography>
      {commands.map((command) => (
        <Box component="pre" key={command} sx={{ m: 0, mt: 1, px: 1.25, py: 1, borderRadius: 1, bgcolor: "background.default", color: "text.primary", fontSize: 12, overflow: "auto" }}>
          {command}
        </Box>
      ))}
      <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copy()} sx={{ mt: 0.75, fontSize: 12 }}>
        {copied ? t("workspace.chat.login.copied") : t("workspace.chat.login.copy")}
      </Button>
    </Box>
  );
}
