import { Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage } from "@writer/lib/backend.ts";

// 助理初始化：先檢查 MCP 位址，接著才檢查並安裝這個 Agent 的 SKILL.md。MCP 不代為安裝。
export function AssistantSetup({ agentID }: { agentID: string }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [hint, setHint] = useState<{ installed: boolean; command: string } | null>(null);
  const [skillVersion, setSkillVersion] = useState("");
  const [copied, setCopied] = useState(false);

  const checkMcp = (id: string) =>
    backend
      .McpInstalled(id)
      .then(setHint)
      .catch((err) => showError(errorMessage(err)));

  useEffect(() => {
    let cancelled = false;
    setHint(null);
    setSkillVersion("");
    setCopied(false);
    backend
      .McpInstalled(agentID)
      .then((next) => {
        if (cancelled) return;
        setHint(next);
        return backend.EnsureSkill(agentID);
      })
      .then((skill) => {
        if (!cancelled && skill?.updated) setSkillVersion(skill.version);
      })
      .catch((err) => {
        if (!cancelled) showError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [agentID, showError]);

  const copy = async () => {
    if (!hint) return;
    try {
      await navigator.clipboard.writeText(hint.command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  if (!hint || (hint.installed && !skillVersion)) return null;

  return (
    <Stack spacing={1}>
      {skillVersion && (
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{t("workspace.chat.skillInstalled", { version: skillVersion })}</Typography>
      )}
      {hint && !hint.installed && (
        <Box sx={{ px: 1.5, py: 1.25, border: 1, borderColor: "divider", borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>{t("workspace.chat.mcpMissing")}</Typography>
          <Box
            component="pre"
            sx={{ m: 0, mt: 1, px: 1.25, py: 1, borderRadius: 1, bgcolor: "action.hover", fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap" }}
          >
            {hint.command}
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => void copy()} sx={{ fontSize: 12.5 }}>
              {copied ? t("workspace.chat.mcpCopied") : t("workspace.chat.mcpCopy")}
            </Button>
            <Button size="small" onClick={() => void checkMcp(agentID)} sx={{ fontSize: 12.5 }}>
              {t("workspace.chat.mcpRecheck")}
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
