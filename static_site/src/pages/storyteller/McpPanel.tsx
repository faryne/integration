import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid,
  Link,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isSteamLoomSite, steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerMcpToolCategories } from "@/apis/storyteller.ts";
import { McpOAuthSetupDialog } from "@/pages/storyteller/McpOAuthSetupDialog.tsx";
import { McpPatSetupDialog } from "@/pages/storyteller/McpPatSetupDialog.tsx";
import { McpSkillPreviewDialog } from "@/pages/storyteller/McpSkillPreviewDialog.tsx";
import { useClipboardCopy } from "@/pages/storyteller/useClipboardCopy.tsx";
import { mcpEndpoint } from "@/pages/storyteller/mcpClientSetup.ts";
import {
  STORYTELLER_MCP_SKILL_UPDATED_AT,
  STORYTELLER_MCP_SKILL_VERSION,
  storytellerMcpSkillDoc,
  storytellerMcpSkillDocBody,
} from "@/pages/storyteller/storytellerMcpSkillDoc.ts";

type ConnectMethod = "oauth" | "pat";

const methodMeta: Record<
  ConnectMethod,
  {
    label: string;
    description: string;
    manageLabel: string;
    managePath: string;
    hint: string;
  }
> = {
  oauth: {
    label: "OAuth 授權",
    description:
      "Claude.ai、ChatGPT、Claude Code、Codex 等支援 OAuth 的工具。不用複製 token，登入確認就好。",
    manageLabel: "管理授權",
    managePath: "my/oauth",
    hint: "在工具裡按下「允許」後就完成了，可以到 OAuth Token 頁確認。",
  },
  pat: {
    label: "Personal Access Token",
    description: "要在設定檔寫入 token 的工具，或不支援 OAuth 的 MCP client。",
    manageLabel: "管理 Token",
    managePath: "my/pat",
    hint: "設定好後重新啟動工具即可連線；token 可以在 Personal Access Token 頁管理。",
  },
};

// 「開發者 › MCP 連接」分頁：三步驟——選連線方式 → 在對應的設定視窗完成設定 → 選用的 Skill。
// 憑證本身的管理分別在 Personal Access Token 與 OAuth Token 頁，這裡只負責把工具接起來。
export function StorytellerMcpPanel() {
  const { copy, snackbars } = useClipboardCopy();
  const [dialog, setDialog] = useState<ConnectMethod | "skill" | null>(null);
  // 步驟 2 完成後的摘要（用哪種方式接了哪個工具），重新整理頁面就重來，不需要保存
  const [configured, setConfigured] = useState<{
    method: ConnectMethod;
    toolLabel: string;
  } | null>(null);
  // 工具清單即時查後端（見 useStorytellerMcpToolCategories 的說明），新增/刪除
  // MCP 工具不用回頭改這個頁面；載入完成前 SKILL.md 預覽/下載都先不可用。
  const { data: toolCategories = [], isLoading: toolCategoriesLoading } =
    useStorytellerMcpToolCategories();
  const skillDocBody = useMemo(
    () => storytellerMcpSkillDocBody(mcpEndpoint, toolCategories),
    [toolCategories],
  );

  const activeStep = configured
    ? 2
    : dialog === "oauth" || dialog === "pat"
      ? 1
      : 0;

  function complete(method: ConnectMethod, toolLabel: string) {
    setConfigured({ method, toolLabel });
    setDialog(null);
  }

  // 純前端下載 SKILL.md；內容不含任何憑證，跟連線方式無關。
  function downloadSkillDoc() {
    const blob = new Blob(
      [storytellerMcpSkillDoc(mcpEndpoint, toolCategories)],
      {
        type: "text/markdown;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "SKILL.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        透過 MCP（Model Context Protocol），你可以讓 Claude、ChatGPT、Codex
        等外部工具直接讀寫你的創作專案、故事內容與世界觀設定，不需要手動複製貼上。
      </Typography>

      <Stepper orientation="vertical" activeStep={activeStep}>
        <Step completed={activeStep > 0} expanded>
          <StepLabel>
            <Typography fontWeight={800}>選擇連線方式</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              依你要連的工具選一種，接著會跳出對應的設定視窗。
            </Typography>
            <Grid container spacing={1.5}>
              {(Object.keys(methodMeta) as ConnectMethod[]).map((method) => (
                <Grid key={method} size={{ xs: 12, md: 6 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderColor:
                        method === "oauth" ? "primary.main" : undefined,
                    }}
                  >
                    <CardActionArea
                      onClick={() => setDialog(method)}
                      sx={{ height: "100%", p: 2, alignItems: "flex-start" }}
                    >
                      <Stack spacing={0.75}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={800}>
                            {methodMeta[method].label}
                          </Typography>
                          {method === "oauth" && (
                            <Chip size="small" color="primary" label="推薦" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {methodMeta[method].description}
                        </Typography>
                      </Stack>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            {!isSteamLoomSite() && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1 }}
              >
                OAuth 只支援 steamloom.works 的網址；faryne.dev 的 MCP
                位址只能搭配 Personal Access Token。
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step completed={Boolean(configured)} expanded>
          <StepLabel>
            <Typography fontWeight={800}>設定你的工具</Typography>
          </StepLabel>
          <StepContent>
            {configured ? (
              <Alert
                severity="success"
                variant="outlined"
                action={
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ "& .MuiButton-root": { whiteSpace: "nowrap" } }}
                  >
                    <Button
                      component={RouterLink}
                      to={steamloomPath(
                        methodMeta[configured.method].managePath,
                      )}
                      color="inherit"
                      size="small"
                    >
                      {methodMeta[configured.method].manageLabel}
                    </Button>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setConfigured(null)}
                    >
                      重新設定
                    </Button>
                  </Stack>
                }
              >
                <strong>
                  已設定：{methodMeta[configured.method].label} ·{" "}
                  {configured.toolLabel}
                </strong>
                <br />
                {methodMeta[configured.method].hint}
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                選好連線方式後，在跳出的視窗裡完成設定。
              </Typography>
            )}
          </StepContent>
        </Step>

        <Step expanded>
          <StepLabel optional={<Typography variant="caption">選用</Typography>}>
            <Typography fontWeight={800}>安裝 Skill</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              SKILL.md 告訴 AI
              有哪些工具、怎麼寫作與改稿、寫入前後要檢查什麼；內容跟連線方式無關。放進
              Claude Code、Codex 等工具的 skill 目錄，或上傳到 Claude.ai 的
              Skills 即可。
            </Typography>
            {/* 讓作者對照手上那份是不是舊版：版本變了就重新下載一次 */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1.5 }}
            >
              目前版本 v{STORYTELLER_MCP_SKILL_VERSION}・最後更新{" "}
              {STORYTELLER_MCP_SKILL_UPDATED_AT}
              ；之前下載過的話，版本不同時請重新下載。
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                disabled={toolCategoriesLoading}
                onClick={downloadSkillDoc}
              >
                下載 SKILL.md
              </Button>
              <Button
                variant="outlined"
                disabled={toolCategoriesLoading}
                onClick={() => setDialog("skill")}
              >
                預覽內容
              </Button>
            </Stack>
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

      <McpOAuthSetupDialog
        open={dialog === "oauth"}
        onClose={() => setDialog(null)}
        onComplete={(toolLabel) => complete("oauth", toolLabel)}
        onCopy={(value) => void copy(value)}
      />
      <McpPatSetupDialog
        open={dialog === "pat"}
        onClose={() => setDialog(null)}
        onComplete={(toolLabel) => complete("pat", toolLabel)}
        onCopy={(value) => void copy(value)}
      />
      <McpSkillPreviewDialog
        open={dialog === "skill"}
        body={skillDocBody}
        onClose={() => setDialog(null)}
        onDownload={downloadSkillDoc}
      />
      {snackbars}
    </Stack>
  );
}
