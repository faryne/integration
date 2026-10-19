import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  Collapse,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { CopyableCode } from "@/pages/storyteller/developerShared.tsx";
import {
  detectSkillInstallerOs,
  mcpSkillInstallers,
  mcpSkillMarkdownUrl,
  mcpSkillZipUrl,
  MCP_SKILL_NAME,
  type McpService,
  type McpSkillInstallerOs,
} from "@/pages/storyteller/mcpClientSetup.ts";

// 步驟 4：依服務顯示 Skill 安裝方式。Claude Code／Codex 用安裝程式（依瀏覽器預選 OS，更新時再跑一次即可），
// Claude.ai／ChatGPT 給 ZIP 上傳步驟，其他工具兩種檔案都能下載。
export function McpSkillInstall({
  service,
  version,
  updatedAt,
  onCopy,
  onPreview,
}: {
  service: McpService;
  version: string;
  updatedAt: string;
  onCopy: (value: string) => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const { skill } = service;
  // 依瀏覽器預選 OS；作者自己切換後就不再顯示「已預先選好」
  const [detectedOs] = useState<McpSkillInstallerOs>(detectSkillInstallerOs);
  const [os, setOs] = useState(detectedOs);
  const [inspectOpen, setInspectOpen] = useState(false);
  const installer = mcpSkillInstallers[os];
  const downloadButton = (label: string, href: string, primary = false) => (
    <Button
      component="a"
      href={href}
      variant={primary ? "contained" : "outlined"}
      startIcon={<DownloadIcon />}
    >
      {label}
    </Button>
  );

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {t("web.mcp.skill.description")}
      </Typography>

      {skill.kind === "installer" && (
        <>
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={os}
              onChange={(_, value) => value && setOs(value)}
            >
              {(Object.keys(mcpSkillInstallers) as McpSkillInstallerOs[]).map(
                (key) => (
                  <ToggleButton key={key} value={key}>
                    {mcpSkillInstallers[key].label}
                  </ToggleButton>
                ),
              )}
            </ToggleButtonGroup>
            {os === detectedOs && (
              <Typography variant="caption" color="text.secondary">
                {t("web.mcp.installer.detected")}
              </Typography>
            )}
          </Stack>
          <CopyableCode
            label={t(installer.runLabel)}
            value={installer.command}
            onCopy={onCopy}
          />
          <Box>
            <Typography variant="body2">
              {t("web.mcp.installer.willDo")}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <li>
                <Typography variant="body2">
                  {t("web.mcp.installer.detect")}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t("web.mcp.installer.update")}
                </Typography>
              </li>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("web.mcp.installer.rerun", { service: t(service.label) })}
          </Typography>
        </>
      )}

      {skill.kind === "upload" && (
        <Box component="ol" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 0.75 } }}>
          {skill.steps.map((step) => (
            <li key={step}>
              <Typography variant="body2">{t(step)}</Typography>
            </li>
          ))}
        </Box>
      )}

      {skill.kind === "download" && (
        <Typography variant="body2">
          <Trans
            i18nKey="web.mcp.skill.downloadPlace"
            values={{ name: MCP_SKILL_NAME }}
            components={{ code: <code /> }}
          />
        </Typography>
      )}

      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
        {skill.kind === "upload" &&
          downloadButton(
            t("web.mcp.skill.downloadZipButton"),
            mcpSkillZipUrl,
            true,
          )}
        {skill.kind === "installer" &&
          downloadButton(t(installer.downloadLabel), installer.downloadUrl)}
        {skill.kind !== "upload" &&
          downloadButton(t("web.mcp.skill.downloadMd"), mcpSkillMarkdownUrl)}
        {skill.kind === "download" &&
          downloadButton(t("web.mcp.skill.downloadZipButton"), mcpSkillZipUrl)}
        <Button variant="outlined" onClick={onPreview}>
          {t("web.mcp.skill.preview")}
        </Button>
      </Stack>

      {skill.kind === "installer" && (
        <Box>
          <Button
            size="small"
            color="inherit"
            onClick={() => setInspectOpen((open) => !open)}
            endIcon={inspectOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {t("web.mcp.installer.inspect")}
          </Button>
          <Collapse in={inspectOpen} unmountOnExit>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {t("web.mcp.installer.inspectHelp")}
            </Typography>
            <CopyableCode value={installer.inspect} onCopy={onCopy} />
          </Collapse>
        </Box>
      )}

      {version && (
        <Typography variant="caption" color="text.secondary">
          {t("web.mcp.skill.version", { version, updatedAt })}
        </Typography>
      )}
    </Stack>
  );
}
