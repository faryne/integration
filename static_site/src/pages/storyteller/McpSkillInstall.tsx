import DownloadIcon from "@mui/icons-material/Download";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { CopyableCode } from "@/pages/storyteller/developerShared.tsx";
import {
  mcpSkillInstallCommand,
  mcpSkillMarkdownUrl,
  mcpSkillZipUrl,
  MCP_SKILL_NAME,
  type McpService,
} from "@/pages/storyteller/mcpClientSetup.ts";

// 步驟 4：依服務顯示 Skill 安裝方式。CLI 工具給一行指令（更新時再跑一次即可），
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

      {skill.kind === "command" && (
        <>
          <Typography variant="body2">
            在終端機執行，{service.label} 會自動載入，不用重啟：
          </Typography>
          <CopyableCode
            value={mcpSkillInstallCommand(skill.dir)}
            onCopy={onCopy}
          />
          <Typography variant="body2" color="text.secondary">
            Skill 更新時，再執行一次同一行指令即可。
            {skill.windowsDir && (
              <>
                {" "}
                Windows 可以手動下載 SKILL.md，放到{" "}
                <code>{skill.windowsDir}</code>。
              </>
            )}
          </Typography>
          <Alert severity="info" variant="outlined">
            之前裝過舊版（資料夾叫 <code>storyteller-mcp</code>
            ）的話，請刪掉舊的，不然新舊兩份會同時載入：
            <Box sx={{ mt: 0.75 }}>
              <CopyableCode
                value={`rm -rf ${skill.legacyDir}`}
                onCopy={onCopy}
              />
            </Box>
          </Alert>
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
        {skill.kind !== "upload" &&
          downloadButton("下載 SKILL.md", mcpSkillMarkdownUrl)}
        {skill.kind === "download" &&
          downloadButton("下載 ZIP", mcpSkillZipUrl)}
        <Button variant="outlined" onClick={onPreview}>
          預覽內容
        </Button>
      </Stack>

      {version && (
        <Typography variant="caption" color="text.secondary">
          目前版本 v{version}・最後更新 {updatedAt}
        </Typography>
      )}
    </Stack>
  );
}
