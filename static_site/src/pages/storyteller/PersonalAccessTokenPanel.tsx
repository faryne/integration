import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { Link as RouterLink } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  useCreateStorytellerPersonalAccessToken,
  useDeleteStorytellerPersonalAccessToken,
  useStorytellerPersonalAccessTokens,
} from "@/apis/storyteller.ts";
import {
  mcpEndpoint,
  useClipboardCopy,
} from "@/pages/storyteller/developerShared.tsx";
import { storytellerMcpClientConfigSnippet } from "@/pages/storyteller/storytellerMcpSkillDoc.ts";
import type {
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
} from "@/types/storyteller.ts";

const expiresInDaysOptions = [
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "180", label: "180 天" },
  { value: "365", label: "365 天" },
  { value: "forever", label: "永久（不過期）" },
] as const;

// 「開發者 › Personal Access Token」分頁：給 Codex CLI 這類要在設定檔寫 token 的本機工具。
// 只輸出內容本體，外層標題／麵包屑交給 Home.tsx 的 WorkspaceChrome。
export function StorytellerPersonalAccessTokenPanel() {
  const { data: tokens = [], isLoading } = useStorytellerPersonalAccessTokens();
  const createToken = useCreateStorytellerPersonalAccessToken();
  const deleteToken = useDeleteStorytellerPersonalAccessToken();
  const { copy, snackbars } = useClipboardCopy();
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [createdToken, setCreatedToken] =
    useState<StorytellerPersonalAccessTokenCreated | null>(null);
  const configSnippet = createdToken
    ? storytellerMcpClientConfigSnippet(mcpEndpoint, createdToken.token)
    : "";

  return (
    <Stack spacing={3}>
      <Alert
        severity="info"
        variant="outlined"
        action={
          <Button
            component={RouterLink}
            to={steamloomPath("my/mcp")}
            color="inherit"
            size="small"
          >
            看連線方式
          </Button>
        }
      >
        要連 Claude.ai、ChatGPT 這類網頁版服務？不用建立 Personal Access
        Token，直接貼 MCP 網址走 OAuth 授權就好。
      </Alert>

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
          <Box>
            <Typography variant="h6">建立 Personal Access Token</Typography>
            <Typography variant="body2" color="text.secondary">
              給 Codex CLI 這類本機工具使用，貼進工具的設定檔即可連線。
            </Typography>
          </Box>
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

      <StorytellerMascotDialog
        open={createdToken !== null}
        state="success"
        eyebrow="Personal Access Token"
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
                  <IconButton onClick={() => void copy(createdToken.token)}>
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
                    {configSnippet}
                  </Box>
                  <Tooltip title="複製設定範例">
                    <IconButton
                      size="small"
                      onClick={() => void copy(configSnippet)}
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

      {snackbars}
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
