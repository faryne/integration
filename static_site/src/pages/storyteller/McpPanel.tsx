import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
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
import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";
import {
  useCreateStorytellerPersonalAccessToken,
  useDeleteStorytellerPersonalAccessToken,
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
  : "https://faryne.dev/api-integration/storyteller/mcp";

const expiresInDaysOptions = [
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "180", label: "180 天" },
  { value: "365", label: "365 天" },
  { value: "forever", label: "永久（不過期）" },
] as const;

function mcpClientConfigSnippet(token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        storyteller: {
          url: mcpEndpoint,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );
}

// MCP 連接分頁是「我的工作台」底下與金鑰管理並排的分頁內容，只輸出內容本體，
// 外層標題／麵包屑交給 Home.tsx 的 StorytellerShell。
export function StorytellerMcpPanel() {
  const { data: tokens = [], isLoading } = useStorytellerPersonalAccessTokens();
  const createToken = useCreateStorytellerPersonalAccessToken();
  const deleteToken = useDeleteStorytellerPersonalAccessToken();
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [copyMessageOpen, setCopyMessageOpen] = useState(false);
  const [createdToken, setCreatedToken] =
    useState<StorytellerPersonalAccessTokenCreated | null>(null);

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopyMessageOpen(true);
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">什麼是 MCP 連接？</Typography>
          <Typography color="text.secondary">
            透過 MCP（Model Context Protocol），你可以讓 Codex、Grok Builds
            等外部工具直接讀寫你的故事專案、故事內容與世界觀設定，不需要手動複製貼上。
            這個連接只開放故事／設定集的 CRUD，不會碰到你站內設定的 AI Agent 或 API
            Key。
          </Typography>
          <Alert severity="info" variant="outlined">
            請把下方的連線位址設定進工具的 MCP
            設定，並附上一組你自己建立的 Personal Access Token 作為 Bearer
            Token。不同工具的設定畫面不太一樣，若工具支援貼上 JSON
            設定，請參考建立完成畫面的範例設定進去。
          </Alert>
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

      <Dialog
        open={createdToken !== null}
        onClose={() => setCreatedToken(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Token 已建立</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="warning" variant="outlined">
              這組 token 只會顯示這一次，請立刻複製並貼到你的 MCP
              設定裡，離開這個視窗後就無法再次查看完整內容。
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
                    <IconButton
                      onClick={() => void copyText(createdToken.token)}
                    >
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
                      {mcpClientConfigSnippet(createdToken.token)}
                    </Box>
                    <Tooltip title="複製設定範例">
                      <IconButton
                        size="small"
                        onClick={() =>
                          void copyText(
                            mcpClientConfigSnippet(createdToken.token),
                          )
                        }
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
                <Alert severity="info" variant="outlined">
                  這個 MCP 端點目前只支援單次請求／單次回應，沒有 SSE
                  streaming。多數工具連線沒問題，但如果你的工具在建立連線時強制要求走
                  SSE 交握，可能會連不上，建議設定好之後先實際測一次連線。
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedToken(null)}>
            我已複製，關閉
          </Button>
        </DialogActions>
      </Dialog>

      <CustomSnackbar
        open={copyMessageOpen}
        message="已複製到剪貼簿"
        onClose={() => setCopyMessageOpen(false)}
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
      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>刪除 Token</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            確定要刪除「{token.label || "（未命名）"}
            」這組 token 嗎？刪除後使用這組 token 的工具會立刻失去連線權限，此操作無法復原。
          </Typography>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </ListItem>
  );
}
