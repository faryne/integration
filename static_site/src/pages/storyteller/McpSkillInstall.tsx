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
        Skill 告訴 AI 怎麼在 SteamLoom 上寫作、改稿，以及寫入前後要檢查什麼。
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
                已依你的瀏覽器預先選好
              </Typography>
            )}
          </Stack>
          <CopyableCode
            label={installer.runLabel}
            value={installer.command}
            onCopy={onCopy}
          />
          <Box>
            <Typography variant="body2">這行指令會：</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <li>
                <Typography variant="body2">
                  偵測這台電腦有沒有裝 Claude Code、Codex，有哪個就裝到哪個
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  已經裝過的話，比對版本，有新版才更新
                </Typography>
              </li>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Skill 更新時，再執行一次同一行指令即可，{service.label}{" "}
            會自動載入，不用重啟。
          </Typography>
        </>
      )}

      {skill.kind === "upload" && (
        <Box component="ol" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 0.75 } }}>
          {skill.steps.map((step) => (
            <li key={step}>
              <Typography variant="body2">{step}</Typography>
            </li>
          ))}
        </Box>
      )}

      {skill.kind === "download" && (
        <Typography variant="body2">
          下載後放進你的工具的 skill 目錄，資料夾名稱用{" "}
          <code>{MCP_SKILL_NAME}</code>。
        </Typography>
      )}

      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
        {skill.kind === "upload" &&
          downloadButton("下載 ZIP", mcpSkillZipUrl, true)}
        {skill.kind === "installer" &&
          downloadButton(installer.downloadLabel, installer.downloadUrl)}
        {skill.kind !== "upload" &&
          downloadButton("下載 SKILL.md", mcpSkillMarkdownUrl)}
        {skill.kind === "download" &&
          downloadButton("下載 ZIP", mcpSkillZipUrl)}
        <Button variant="outlined" onClick={onPreview}>
          預覽內容
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
            想先看過安裝程式再執行？
          </Button>
          <Collapse in={inspectOpen} unmountOnExit>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              下載後用文字編輯器打開確認內容，再執行：
            </Typography>
            <CopyableCode value={installer.inspect} onCopy={onCopy} />
          </Collapse>
        </Box>
      )}

      {version && (
        <Typography variant="caption" color="text.secondary">
          目前版本 v{version}・最後更新 {updatedAt}
        </Typography>
      )}
    </Stack>
  );
}
