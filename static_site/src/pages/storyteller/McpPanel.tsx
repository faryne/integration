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
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      <Typography color="text.secondary">{t("web.mcp.intro")}</Typography>

      <Stepper orientation="vertical" activeStep={activeStep}>
        <Step completed={Boolean(service)} expanded>
          <StepLabel>
            <Typography fontWeight={800}>
              {t("web.mcp.steps.service")}
            </Typography>
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
            <Typography fontWeight={800}>{t("web.mcp.steps.auth")}</Typography>
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
                {t("web.mcp.steps.authPending")}
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step expanded>
          <StepLabel>
            <Typography fontWeight={800}>{t("web.mcp.steps.setup")}</Typography>
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
                {t("web.mcp.steps.setupPending")}
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step expanded>
          <StepLabel
            optional={
              <Typography variant="caption">
                {t("web.mcp.steps.optional")}
              </Typography>
            }
          >
            <Typography fontWeight={800}>{t("web.mcp.steps.skill")}</Typography>
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
                {t("web.mcp.steps.skillPending")}
              </Typography>
            )}
          </StepContent>
        </Step>
      </Stepper>

      <Box>
        <Typography variant="caption" color="text.secondary">
          <Trans
            i18nKey="web.mcp.endpointNote"
            values={{ endpoint: mcpEndpoint }}
            components={{
              code: <code />,
              link: (
                <Link
                  href="https://modelcontextprotocol.io/docs/develop/connect-remote-servers"
                  target="_blank"
                  rel="noopener"
                />
              ),
            }}
          />
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
        message={t("web.mcp.skill.previewFailed")}
        severity="error"
        onClose={() => setPreviewOpen(false)}
      />
      {snackbars}
    </Stack>
  );
}
