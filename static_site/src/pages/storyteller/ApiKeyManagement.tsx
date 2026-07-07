import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyIcon from "@mui/icons-material/Key";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  Chip,
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
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useCreateStorytellerProviderAPIKey,
  useDeleteStorytellerProviderAPIKey,
  useStorytellerAgentProviderModels,
  useStorytellerAgents,
  useStorytellerProviderAPIKeys,
  useTestStorytellerProviderAPIKey,
  useUpdateStorytellerProviderAPIKey,
} from "@/apis/storyteller.ts";
import type {
  StorytellerProviderAPIKey,
  StorytellerProviderAPIKeyRequest,
} from "@/types/storyteller.ts";

// 金鑰管理是「我的工作台」底下與故事專案／AI Agent 並排的分頁內容，
// 不再是獨立頁面，所以這裡只輸出內容本體，外層標題／麵包屑交給 Home.tsx 的 StorytellerShell。
export function StorytellerApiKeyPanel() {
  const { data: providerModels = [] } = useStorytellerAgentProviderModels();
  const { data: apiKeys = [], isLoading } = useStorytellerProviderAPIKeys();
  const { data: agents = [] } = useStorytellerAgents();
  const createApiKey = useCreateStorytellerProviderAPIKey();
  const deleteApiKey = useDeleteStorytellerProviderAPIKey();

  const boundAgentNames = (apiKeyId: number) =>
    agents
      .filter((agent) => agent.provider_apikey_id === apiKeyId)
      .map((agent) => agent.name);
  const [input, setInput] = useState<StorytellerProviderAPIKeyRequest>({
    provider: "grok",
    label: "",
    api_key: "",
  });

  const providerLabel = (provider: string) =>
    providerModels.find((item) => item.provider === provider)?.label ??
    provider;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault();
            createApiKey.mutate(input, {
              onSuccess: () => {
                setInput((value) => ({ ...value, label: "", api_key: "" }));
              },
            });
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="h6">新增金鑰</Typography>
            <Tooltip
              title={
                <Stack spacing={0.5} sx={{ py: 0.5 }}>
                  <Typography variant="caption" fontWeight={500}>
                    你的 API Key 會被這樣保護：
                  </Typography>
                  <Typography variant="caption">
                    ・以加密方式儲存，資料庫內不會留下明文。
                  </Typography>
                  <Typography variant="caption">
                    ・只有在你觸發 Agent
                    執行、測試連線，或系統定期更新加密方式時，才會在伺服器端短暫解密使用。
                  </Typography>
                  <Typography variant="caption">
                    ・僅用來呼叫你指定的 AI
                    供應商完成當次請求，不會挪作他用，也不會分享給第三方。
                  </Typography>
                  <Typography variant="caption">
                    ・畫面上不會再顯示明文，之後只能刪除，無法重新檢視完整金鑰。
                  </Typography>
                </Stack>
              }
              arrow
              placement="right"
            >
              <InfoOutlinedIcon
                fontSize="small"
                sx={{ color: "text.secondary", cursor: "help" }}
              />
            </Tooltip>
          </Stack>
          {createApiKey.isError && (
            <Alert severity="error" variant="outlined">
              新增金鑰失敗，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                required
                fullWidth
                select
                label="AI 供應商"
                value={input.provider}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    provider: event.target.value,
                  }))
                }
              >
                {providerModels.map((provider) => (
                  <MenuItem key={provider.provider} value={provider.provider}>
                    {provider.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="金鑰名稱"
                placeholder="例如：測試用、正式用"
                value={input.label}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    label: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                required
                fullWidth
                type="password"
                label="API Key"
                value={input.api_key}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    api_key: event.target.value,
                  }))
                }
                slotProps={{
                  input: {
                    startAdornment: <KeyIcon color="disabled" sx={{ mr: 1 }} />,
                  },
                }}
              />
            </Grid>
            <Grid
              size={{ xs: 12, md: 2 }}
              sx={{ display: "flex", alignItems: "center" }}
            >
              <Button
                type="submit"
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                disabled={createApiKey.isPending}
              >
                {createApiKey.isPending ? "新增中" : "新增"}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack sx={{ p: { xs: 2, md: 3 } }} spacing={1}>
          <Typography variant="h6">已建立的金鑰</Typography>
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : apiKeys.length === 0 ? (
            <Alert severity="info" variant="outlined">
              尚未建立任何金鑰，請先在上方新增。
            </Alert>
          ) : (
            <List disablePadding>
              {apiKeys.map((apiKey, index) => (
                <Stack key={apiKey.id}>
                  {index > 0 && <Divider component="li" />}
                  <ProviderApiKeyRow
                    apiKey={apiKey}
                    providerLabel={providerLabel(apiKey.provider)}
                    boundAgentNames={boundAgentNames(apiKey.id)}
                    onDelete={() => deleteApiKey.mutate(apiKey.id)}
                    deletePending={deleteApiKey.isPending}
                  />
                </Stack>
              ))}
            </List>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function providerApiKeyTestStatusText(apiKey: StorytellerProviderAPIKey) {
  if (!apiKey.last_tested_at || apiKey.last_test_ok === null) {
    return "尚未測試連線";
  }
  const testedAt = new Date(apiKey.last_tested_at).toLocaleString();
  return apiKey.last_test_ok
    ? `上次測試於 ${testedAt} 連線成功`
    : `上次測試於 ${testedAt} 連線失敗`;
}

const testCooldownSeconds = 30;

function ProviderApiKeyRow({
  apiKey,
  providerLabel,
  boundAgentNames,
  onDelete,
  deletePending,
}: {
  apiKey: StorytellerProviderAPIKey;
  providerLabel: string;
  boundAgentNames: string[];
  onDelete: () => void;
  deletePending: boolean;
}) {
  const testApiKey = useTestStorytellerProviderAPIKey();
  const updateApiKey = useUpdateStorytellerProviderAPIKey();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(apiKey.label);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isTesting = testApiKey.isPending && testApiKey.variables === apiKey.id;

  // 避免使用者誤按或連按送出重複的測試連線請求，按下後鎖定一段時間再開放
  useEffect(() => {
    if (cooldownEndsAt === null) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  useEffect(() => {
    if (cooldownEndsAt !== null && now >= cooldownEndsAt) {
      setCooldownEndsAt(null);
    }
  }, [now, cooldownEndsAt]);

  const cooldownRemainingSeconds = cooldownEndsAt
    ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000))
    : 0;
  const isCoolingDown = cooldownRemainingSeconds > 0;

  function startEditing() {
    setDraftLabel(apiKey.label);
    setIsEditingLabel(true);
  }

  function saveLabel() {
    updateApiKey.mutate(
      { id: apiKey.id, input: { label: draftLabel } },
      { onSuccess: () => setIsEditingLabel(false) },
    );
  }

  function runTest() {
    setCooldownEndsAt(Date.now() + testCooldownSeconds * 1000);
    testApiKey.mutate(apiKey.id);
  }

  return (
    <ListItem
      secondaryAction={
        <Stack direction="row" spacing={0.5}>
          {!isEditingLabel && (
            <Tooltip title="查看用量">
              <IconButton
                edge="end"
                component={RouterLink}
                to={`/storyteller/my/usage?apikey=${apiKey.id}`}
              >
                <QueryStatsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!isEditingLabel && (
            <Tooltip
              title={
                isCoolingDown
                  ? `請稍候 ${cooldownRemainingSeconds} 秒後再試`
                  : "測試連線"
              }
            >
              <span>
                <IconButton
                  edge="end"
                  disabled={isTesting || isCoolingDown}
                  onClick={runTest}
                >
                  {isTesting ? (
                    <CircularProgress size={20} />
                  ) : apiKey.last_test_ok === null ? (
                    <NetworkCheckIcon fontSize="small" />
                  ) : apiKey.last_test_ok ? (
                    <CheckCircleIcon fontSize="small" color="success" />
                  ) : (
                    <ErrorIcon fontSize="small" color="error" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {!isEditingLabel && (
            <Tooltip title="編輯名稱">
              <IconButton edge="end" onClick={startEditing}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="刪除金鑰">
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
        </Stack>
      }
    >
      <ListItemIcon>
        <KeyIcon color="disabled" />
      </ListItemIcon>
      {isEditingLabel ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ width: 1, mr: 12 }}
        >
          <Chip size="small" label={providerLabel} />
          <TextField
            autoFocus
            size="small"
            placeholder="金鑰名稱"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveLabel();
              }
            }}
            sx={{ flex: 1 }}
          />
          <Tooltip title="儲存">
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={updateApiKey.isPending}
                onClick={saveLabel}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="取消">
            <IconButton size="small" onClick={() => setIsEditingLabel(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : (
        <ListItemText
          primary={
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Chip size="small" label={providerLabel} />
              <Typography variant="body1">
                {apiKey.label || "（未命名）"}
              </Typography>
              {boundAgentNames.length > 0 ? (
                <Tooltip title={boundAgentNames.join("、")} arrow>
                  <Chip
                    size="small"
                    label={`使用中：${boundAgentNames.length} 個 Agent`}
                  />
                </Tooltip>
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  label="未被任何 Agent 使用"
                />
              )}
            </Stack>
          }
          secondary={
            <Stack direction="row" spacing={0.75} alignItems="center">
              {apiKey.last_tested_at === null ||
              apiKey.last_test_ok === null ? (
                <HelpOutlineIcon fontSize="inherit" color="disabled" />
              ) : apiKey.last_test_ok ? (
                <CheckCircleIcon fontSize="inherit" color="success" />
              ) : (
                <ErrorIcon fontSize="inherit" color="error" />
              )}
              <span>
                建立於 {new Date(apiKey.created_at).toLocaleString()}・
                {providerApiKeyTestStatusText(apiKey)}
              </span>
            </Stack>
          }
          slotProps={{ secondary: { component: "div" } }}
        />
      )}
      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>刪除金鑰</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              確定要刪除「{apiKey.label || "（未命名）"}」這把金鑰嗎？此操作無法復原。
            </Typography>
            {boundAgentNames.length > 0 ? (
              <Alert severity="warning" variant="outlined">
                目前有 {boundAgentNames.length} 個 AI Agent 使用這把金鑰：
                {boundAgentNames.join("、")}。刪除後這些 Agent 會失去綁定的金鑰，需要重新指定才能繼續使用。
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                目前沒有 AI Agent 使用這把金鑰。
              </Typography>
            )}
          </Stack>
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
            刪除金鑰
          </Button>
        </DialogActions>
      </Dialog>
    </ListItem>
  );
}
