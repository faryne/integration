import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import KeyIcon from "@mui/icons-material/Key";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import {
  STORYTELLER_MCP_SKILL_FRONTMATTER,
  storytellerMcpClientConfigSnippet,
  storytellerMcpSkillDoc,
  storytellerMcpSkillDocBody,
} from "@/pages/storyteller/storytellerMcpSkillDoc.ts";
import {
  useCreateStorytellerPersonalAccessToken,
  useDeleteStorytellerPersonalAccessToken,
  useStorytellerMcpToolCategories,
  useStorytellerPersonalAccessTokens,
} from "@/apis/storyteller.ts";
import type {
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
} from "@/types/storyteller.ts";

// MCP endpoint 是給外部工具（Codex、Grok Builds 等）直接連線用，不透過前端自己的
// /api-integration 呼叫路徑；兩個網域各自有 nginx 對應規則，這裡照網域顯示對的網址。
const mcpEndpoint = isSteamLoomSite()
  ? "https://steamloom.works/mcp"
  : "https://faryne.dev/api-integration/storyteller-mcp";

const expiresInDaysOptions = [
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "180", label: "180 天" },
  { value: "365", label: "365 天" },
  { value: "forever", label: "永久（不過期）" },
] as const;

// MCP 連接分頁是「我的工作台」底下與金鑰管理並排的分頁內容，只輸出內容本體，
// 外層標題／麵包屑交給 Home.tsx 的 StorytellerShell。
export function StorytellerMcpPanel() {
  const { data: tokens = [], isLoading } = useStorytellerPersonalAccessTokens();
  const createToken = useCreateStorytellerPersonalAccessToken();
  const deleteToken = useDeleteStorytellerPersonalAccessToken();
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
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [copyMessageOpen, setCopyMessageOpen] = useState(false);
  const [copyErrorOpen, setCopyErrorOpen] = useState(false);
  const [createdToken, setCreatedToken] =
    useState<StorytellerPersonalAccessTokenCreated | null>(null);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessageOpen(true);
    } catch {
      setCopyErrorOpen(true);
    }
  }

  // 純前端下載通用 SKILL.md；內容使用 PAT 佔位符，避免把使用者真實 token 寫進檔案。
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
            透過 MCP（Model Context Protocol），你可以讓 Codex、Grok Builds
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
              <IconButton onClick={() => void copyText(mcpEndpoint)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            建立下方 Personal Access Token
            後會附上設定範例；不確定怎麼在工具裡設定 MCP client 可參考
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
          <Typography variant="body2" color="text.secondary">
            目前不支援 SSE，若工具連線卡住可能是這個原因。
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault();
            createToken.mutate(
              {
                label,
                expires_in_days:
                  expiresInDays === "forever"
                    ? undefined
                    : Number(expiresInDays),
              },
              {
                onSuccess: (created) => {
                  if (created) {
                    setCreatedToken(created);
                  }
                  setLabel("");
                  setExpiresInDays("30");
                },
              },
            );
          }}
        >
          <Typography variant="h6">建立 Personal Access Token</Typography>
          {createToken.isError && (
            <Alert severity="error" variant="outlined">
              建立 token 失敗，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                required
                fullWidth
                label="名稱"
                placeholder="例如：Codex、我的筆電"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                select
                label="效期"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
              >
                {expiresInDaysOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid
              size={{ xs: 12, md: 3 }}
              sx={{ display: "flex", alignItems: "center" }}
            >
              <Button
                type="submit"
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                disabled={createToken.isPending || !label.trim()}
              >
                {createToken.isPending ? "建立中" : "建立"}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack sx={{ p: { xs: 2, md: 3 } }} spacing={1}>
          <Typography variant="h6">已建立的 Token</Typography>
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : tokens.length === 0 ? (
            <Alert severity="info" variant="outlined">
              尚未建立任何 token，請先在上方建立。
            </Alert>
          ) : (
            <List disablePadding>
              {tokens.map((token, index) => (
                <Stack key={token.id}>
                  {index > 0 && <Divider component="li" />}
                  <PersonalAccessTokenRow
                    token={token}
                    onDelete={() => deleteToken.mutate(token.id)}
                    deletePending={deleteToken.isPending}
                  />
                </Stack>
              ))}
            </List>
          )}
        </Stack>
      </Paper>

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
                以下是給 AI Agent
                讀的完整設定與方法說明，可以直接下載後放進你的 Agent 的 skill 目錄。
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
                "& pre": {
                  m: 0,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontSize: 12,
                  overflowX: "auto",
                },
                "& code": {
                  fontFamily: "monospace",
                },
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Frontmatter
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >
                {STORYTELLER_MCP_SKILL_FRONTMATTER}
              </Box>
              <StorytellerMarkdown>{skillDocBody}</StorytellerMarkdown>
            </Box>
          )}
        </Stack>
      </Paper>

      <StorytellerMascotDialog
        open={createdToken !== null}
        state="success"
        eyebrow="MCP 連接"
        title="Token 已建立"
        onClose={() => setCreatedToken(null)}
        actions={
          <Button variant="contained" onClick={() => setCreatedToken(null)}>
            我已複製，關閉
          </Button>
        }
      >
        <Stack spacing={1.5}>
          <Alert severity="warning" variant="outlined">
            這組 token
            只會顯示這一次，請妥善保存，離開這個視窗後就無法再次查看完整內容。
          </Alert>
          {createdToken && (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label="Token"
                  value={createdToken.token}
                  slotProps={{ input: { readOnly: true } }}
                />
                <Tooltip title="複製 token">
                  <IconButton onClick={() => void copyText(createdToken.token)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  MCP client 設定範例：
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box
                    component="pre"
                    sx={{
                      flex: 1,
                      m: 0,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      fontSize: 12,
                      overflowX: "auto",
                    }}
                  >
                    {storytellerMcpClientConfigSnippet(
                      mcpEndpoint,
                      createdToken.token,
                    )}
                  </Box>
                  <Tooltip title="複製設定範例">
                    <IconButton
                      size="small"
                      onClick={() =>
                        void copyText(
                          storytellerMcpClientConfigSnippet(
                            mcpEndpoint,
                            createdToken.token,
                          ),
                        )
                      }
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </StorytellerMascotDialog>

      <CustomSnackbar
        open={copyMessageOpen}
        message="已複製到剪貼簿"
        onClose={() => setCopyMessageOpen(false)}
      />
      <CustomSnackbar
        open={copyErrorOpen}
        message="複製失敗，請手動選取內容。"
        severity="error"
        onClose={() => setCopyErrorOpen(false)}
      />
      <CustomSnackbar
        open={createToken.isError}
        message="建立 Token 失敗，請確認欄位內容後重試。"
        severity="error"
        onClose={() => createToken.reset()}
      />
      <CustomSnackbar
        open={deleteToken.isError}
        message="Token 刪除失敗，請稍後再試。"
        severity="error"
        onClose={() => deleteToken.reset()}
      />
    </Stack>
  );
}

function PersonalAccessTokenRow({
  token,
  onDelete,
  deletePending,
}: {
  token: StorytellerPersonalAccessToken;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isExpired =
    token.expires_at !== null && new Date(token.expires_at) < new Date();

  return (
    <ListItem
      secondaryAction={
        <Tooltip title="刪除 token">
          <IconButton
            edge="end"
            disabled={deletePending}
            onClick={() => setConfirmingDelete(true)}
            sx={{
              bgcolor: "error.main",
              color: "error.contrastText",
              "&:hover": { bgcolor: "error.dark" },
              "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemIcon>
        <KeyIcon color={isExpired ? "disabled" : "action"} />
      </ListItemIcon>
      <ListItemText
        primary={token.label || "（未命名）"}
        secondary={
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            <span>
              {token.token_prefix}
              {"…"}・建立於 {new Date(token.created_at).toLocaleString()}
            </span>
            <span>
              {token.last_used_at
                ? `上次使用於 ${new Date(token.last_used_at).toLocaleString()}`
                : "尚未使用過"}
              {token.expires_at &&
                `・${isExpired ? "已於" : "將於"} ${new Date(
                  token.expires_at,
                ).toLocaleString()} ${isExpired ? "過期" : "到期"}`}
            </span>
          </Stack>
        }
        slotProps={{ secondary: { component: "div" } }}
      />
      <StorytellerMascotDialog
        open={confirmingDelete}
        state="danger"
        eyebrow="刪除 Token"
        title={`確定要刪除「${token.label || "（未命名）"}」？`}
        description="刪除後使用這組 Token 的工具會立刻失去連線權限，此操作無法復原。"
        onClose={() => setConfirmingDelete(false)}
        actions={
          <>
            <Button onClick={() => setConfirmingDelete(false)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deletePending}
              onClick={() => {
                onDelete();
                setConfirmingDelete(false);
              }}
            >
              刪除 Token
            </Button>
          </>
        }
      />
    </ListItem>
  );
}
