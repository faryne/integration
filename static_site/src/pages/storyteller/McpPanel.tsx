import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isSteamLoomSite, steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import {
  mcpEndpoint,
  oauthMcpEndpoint,
  useClipboardCopy,
} from "@/pages/storyteller/developerShared.tsx";
import {
  STORYTELLER_MCP_SKILL_FRONTMATTER,
  storytellerMcpClientConfigSnippet,
  storytellerMcpSkillDoc,
  storytellerMcpSkillDocBody,
} from "@/pages/storyteller/storytellerMcpSkillDoc.ts";
import { useStorytellerMcpToolCategories } from "@/apis/storyteller.ts";

const codeBlockSx = {
  m: 0,
  p: 1.5,
  borderRadius: 1,
  bgcolor: "action.hover",
  fontSize: 12,
  overflowX: "auto",
} as const;

// 「開發者 › MCP 連接」分頁：連線位址、兩種接法（OAuth／Personal Access Token）與
// 給 AI Agent 的 SKILL.md；憑證本身的管理分別在 Personal Access Token 與 OAuth Token 頁。
export function StorytellerMcpPanel() {
  const { copy, snackbars } = useClipboardCopy();
  // 工具清單即時查後端（見 useStorytellerMcpToolCategories 的說明），新增/刪除
  // MCP 工具不用回頭改這個頁面；載入完成前 SKILL.md 預覽/下載都先不可用，
  // 避免下載到一份缺方法列表的檔案。
  const { data: toolCategories = [], isLoading: toolCategoriesLoading } =
    useStorytellerMcpToolCategories();
  const skillDocBody = useMemo(
    () => storytellerMcpSkillDocBody(mcpEndpoint, toolCategories),
    [toolCategories],
  );
  const skillDocContent = useMemo(
    () => storytellerMcpSkillDoc(mcpEndpoint, toolCategories),
    [toolCategories],
  );

  // 純前端下載通用 SKILL.md；內容使用 token 佔位符，避免把使用者真實 token 寫進檔案。
  function downloadSkillDoc() {
    const blob = new Blob([skillDocContent], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "SKILL.md";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">什麼是 MCP 連接？</Typography>
          <Typography color="text.secondary">
            透過 MCP（Model Context Protocol），你可以讓 Claude、ChatGPT、Codex
            等外部工具直接讀寫你的創作專案、故事內容與世界觀設定，不需要手動複製貼上。
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              label="MCP 連線位址"
              value={mcpEndpoint}
              slotProps={{ input: { readOnly: true } }}
            />
            <Tooltip title="複製連線位址">
              <IconButton onClick={() => void copy(mcpEndpoint)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            不確定怎麼在工具裡設定 MCP client 可參考
            <Link
              href="https://modelcontextprotocol.io/docs/develop/connect-remote-servers"
              target="_blank"
              rel="noopener"
              sx={{ ml: 0.5 }}
            >
              MCP 官方文件
            </Link>
            。目前不支援 SSE，若工具連線卡住可能是這個原因。
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ConnectMethodCard
            title="OAuth 授權"
            recommended
            description="適用 Claude.ai、ChatGPT 等網頁版服務，以及支援 OAuth 的 MCP client。"
            action={
              <Button
                component={RouterLink}
                to={steamloomPath("my/oauth")}
                variant="outlined"
                size="small"
              >
                管理已授權的應用程式
              </Button>
            }
          >
            <Box
              component="ol"
              sx={{ m: 0, pl: 2.5, typography: "body2", lineHeight: 1.9 }}
            >
              <li>
                在工具裡新增自訂 connector，貼上 <code>{oauthMcpEndpoint}</code>
              </li>
              <li>跳出 Steamloom 授權頁，確認後按「允許」</li>
              <li>完成，之後可在「OAuth Token」頁管理或撤銷</li>
            </Box>
            <Typography variant="caption" color="text.secondary">
              不需要填 Client ID／Client Secret，工具會自動向 Steamloom
              註冊。若工具要求手動填寫，代表它不支援自動註冊，請改用 Personal
              Access Token。
              {!isSteamLoomSite() &&
                "OAuth 只支援 steamloom.works 的網址，上方的 faryne.dev 位址只能搭配 Personal Access Token。"}
            </Typography>
          </ConnectMethodCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ConnectMethodCard
            title="Personal Access Token"
            description="適用 Codex CLI 等需要在設定檔寫入 token 的本機工具。"
            action={
              <Button
                component={RouterLink}
                to={steamloomPath("my/pat")}
                variant="outlined"
                size="small"
              >
                建立 Personal Access Token
              </Button>
            }
          >
            <Box component="pre" sx={codeBlockSx}>
              {storytellerMcpClientConfigSnippet(mcpEndpoint)}
            </Box>
          </ConnectMethodCard>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6">給 AI Agent 的說明文件</Typography>
              <Typography color="text.secondary">
                以下是給 AI Agent 讀的完整設定與方法說明，可以直接下載後放進你的
                Agent 的 skill 目錄。
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadSkillDoc}
              disabled={toolCategoriesLoading}
              sx={{ flexShrink: 0 }}
            >
              下載 SKILL.md
            </Button>
          </Stack>
          {toolCategoriesLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Box
              sx={{
                maxHeight: { xs: 360, md: 520 },
                overflowY: "auto",
                border: "1px solid",
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
              <StorytellerMarkdown>{skillDocBody}</StorytellerMarkdown>
            </Box>
          )}
        </Stack>
      </Paper>

      {snackbars}
    </Stack>
  );
}

// 兩種接法的說明卡片共用同一個版型：標題、適用情境、內容、底部動作按鈕。
function ConnectMethodCard({
  title,
  description,
  recommended = false,
  action,
  children,
}: {
  title: string;
  description: string;
  recommended?: boolean;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 1,
        height: "100%",
        borderColor: recommended ? "primary.main" : undefined,
      }}
    >
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">{title}</Typography>
          {recommended && <Chip size="small" color="primary" label="推薦" />}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {children}
        <Box sx={{ mt: "auto !important" }}>{action}</Box>
      </Stack>
    </Paper>
  );
}
