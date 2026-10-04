import {
  Box,
  Link,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useStorytellerMcpSkill } from "@/apis/storyteller.ts";
import {
  McpAuthPicker,
  McpServicePicker,
} from "@/pages/storyteller/McpConnectPickers.tsx";
import { McpConnectSetup } from "@/pages/storyteller/McpConnectSetup.tsx";
import { McpSkillInstall } from "@/pages/storyteller/McpSkillInstall.tsx";
import { McpSkillPreviewDialog } from "@/pages/storyteller/McpSkillPreviewDialog.tsx";
import { useClipboardCopy } from "@/pages/storyteller/useClipboardCopy.tsx";
import {
  availableAuthMethods,
  mcpEndpoint,
  type McpAuthMethod,
  type McpService,
} from "@/pages/storyteller/mcpClientSetup.ts";

// 「開發者 › MCP 連接」分頁：四步驟——選 AI 服務 → 選它支援的授權方式 → 照著設定 → 選用的 Skill。
// 作者先講自己用的是什麼服務，後面才問 OAuth／PAT，不用一開始就懂這兩個詞。
// 憑證本身的管理分別在 Personal Access Token 與 OAuth Token 頁，這裡只負責把工具接起來。
export function StorytellerMcpPanel() {
  const { copy, snackbars } = useClipboardCopy();
  const [service, setService] = useState<McpService | null>(null);
  const [method, setMethod] = useState<McpAuthMethod | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const skill = useStorytellerMcpSkill();

  // 換服務時重算授權方式：只支援一種就直接帶入，否則讓作者自己選
  function selectService(next: McpService) {
    if (next.key === service?.key) return;
    const methods = availableAuthMethods(next);
    setService(next);
    setMethod(methods.length === 1 ? methods[0] : null);
  }

  const activeStep = !service ? 0 : !method ? 1 : 2;
  const onCopy = (value: string) => void copy(value);

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        透過 MCP（Model Context Protocol），你可以讓 Claude、ChatGPT、Codex 等
        AI 服務直接讀寫你的創作專案、故事內容與世界觀設定，不需要手動複製貼上。
      </Typography>

      <Stepper orientation="vertical" activeStep={activeStep}>
        <Step completed={Boolean(service)} expanded>
          <StepLabel>
            <Typography fontWeight={800}>選擇你使用的 AI 服務</Typography>
          </StepLabel>
          <StepContent>
            <McpServicePicker
              value={service?.key ?? null}
              onChange={selectService}
            />
          </StepContent>
        </Step>

        <Step completed={Boolean(method)} expanded>
          <StepLabel>
            <Typography fontWeight={800}>選擇授權方式</Typography>
          </StepLabel>
          <StepContent>
            {service ? (
              <McpAuthPicker
                service={service}
                value={method}
                onChange={setMethod}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                先選 AI 服務，這裡會列出它支援的授權方式。
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step expanded>
          <StepLabel>
            <Typography fontWeight={800}>連線設定</Typography>
          </StepLabel>
          <StepContent>
            {service && method ? (
              <McpConnectSetup
                key={`${service.key}-${method}`}
                service={service}
                method={method}
                onCopy={onCopy}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                選好授權方式後，這裡會列出設定步驟。
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step expanded>
          <StepLabel optional={<Typography variant="caption">選用</Typography>}>
            <Typography fontWeight={800}>安裝 Skill</Typography>
          </StepLabel>
          <StepContent>
            {service ? (
              <McpSkillInstall
                service={service}
                version={skill.data?.version ?? ""}
                updatedAt={skill.data?.updatedAt ?? ""}
                onCopy={onCopy}
                onPreview={() => setPreviewOpen(true)}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Skill 告訴 AI 怎麼在 SteamLoom
                上寫作、改稿，以及寫入前後要檢查什麼。選好 AI
                服務後會顯示安裝方式。
              </Typography>
            )}
          </StepContent>
        </Step>
      </Stepper>

      <Box>
        <Typography variant="caption" color="text.secondary">
          MCP 連線位址：<code>{mcpEndpoint}</code>・目前不支援
          SSE，若工具連線卡住可能是這個原因。不確定怎麼設定可參考
          <Link
            href="https://modelcontextprotocol.io/docs/develop/connect-remote-servers"
            target="_blank"
            rel="noopener"
            sx={{ ml: 0.5 }}
          >
            MCP 官方文件
          </Link>
          。
        </Typography>
      </Box>

      <McpSkillPreviewDialog
        open={previewOpen && Boolean(skill.data)}
        frontmatter={skill.data?.frontmatter ?? ""}
        body={skill.data?.body ?? ""}
        version={skill.data?.version ?? ""}
        onClose={() => setPreviewOpen(false)}
      />
      {/* 預覽要讀後端的 SKILL.md；讀不到時告訴作者，連線設定的步驟不受影響 */}
      <CustomSnackbar
        open={previewOpen && skill.isError}
        message="讀取 Skill 內容失敗，請稍後再試。"
        severity="error"
        onClose={() => setPreviewOpen(false)}
      />
      {snackbars}
    </Stack>
  );
}
