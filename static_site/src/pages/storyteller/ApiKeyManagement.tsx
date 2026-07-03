import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorIcon from "@mui/icons-material/Error";
import KeyIcon from "@mui/icons-material/Key";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import {
  Alert,
  Button,
  Chip,
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
import {
  useCreateStorytellerProviderAPIKey,
  useDeleteStorytellerProviderAPIKey,
  useStorytellerAgentProviderModels,
  useStorytellerProviderAPIKeys,
  useTestStorytellerProviderAPIKey,
} from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerProviderAPIKeyRequest } from "@/types/storyteller.ts";

export default function StorytellerApiKeyManagement() {
  const { data: providerModels = [] } = useStorytellerAgentProviderModels();
  const { data: apiKeys = [], isLoading } = useStorytellerProviderAPIKeys();
  const createApiKey = useCreateStorytellerProviderAPIKey();
  const deleteApiKey = useDeleteStorytellerProviderAPIKey();
  const testApiKey = useTestStorytellerProviderAPIKey();
  const [testResults, setTestResults] = useState<
    Record<number, "ok" | "failed">
  >({});
  const [input, setInput] = useState<StorytellerProviderAPIKeyRequest>({
    provider: "grok",
    label: "",
    api_key: "",
  });

  useTitle("金鑰管理", {
    path: "/storyteller/my/api-keys",
    robots: "noindex, nofollow",
  });

  const providerLabel = (provider: string) =>
    providerModels.find((item) => item.provider === provider)?.label ??
    provider;

  return (
    <StorytellerShell
      title="金鑰管理"
      description="管理各 AI 供應商的 API Key，建立 Agent 時可從這裡選擇要使用的金鑰。同一個供應商可以保留多把金鑰（例如測試用一把、正式用一把）。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "金鑰管理" },
      ]}
    >
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
            <Typography variant="h6">新增金鑰</Typography>
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
                      startAdornment: (
                        <KeyIcon color="disabled" sx={{ mr: 1 }} />
                      ),
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
                    <ListItem
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="測試連線">
                            <span>
                              <IconButton
                                edge="end"
                                disabled={
                                  testApiKey.isPending &&
                                  testApiKey.variables === apiKey.id
                                }
                                onClick={() => {
                                  testApiKey.mutate(apiKey.id, {
                                    onSuccess: () =>
                                      setTestResults((value) => ({
                                        ...value,
                                        [apiKey.id]: "ok",
                                      })),
                                    onError: () =>
                                      setTestResults((value) => ({
                                        ...value,
                                        [apiKey.id]: "failed",
                                      })),
                                  });
                                }}
                              >
                                {testApiKey.isPending &&
                                testApiKey.variables === apiKey.id ? (
                                  <CircularProgress size={20} />
                                ) : testResults[apiKey.id] === "ok" ? (
                                  <CheckCircleIcon
                                    fontSize="small"
                                    color="success"
                                  />
                                ) : testResults[apiKey.id] === "failed" ? (
                                  <ErrorIcon fontSize="small" color="error" />
                                ) : (
                                  <NetworkCheckIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="刪除金鑰">
                            <IconButton
                              edge="end"
                              disabled={deleteApiKey.isPending}
                              onClick={() => deleteApiKey.mutate(apiKey.id)}
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
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="small"
                              label={providerLabel(apiKey.provider)}
                            />
                            <Typography variant="body1">
                              {apiKey.label || "（未命名）"}
                            </Typography>
                          </Stack>
                        }
                        secondary={`建立於 ${new Date(apiKey.created_at).toLocaleString()}`}
                      />
                    </ListItem>
                  </Stack>
                ))}
              </List>
            )}
          </Stack>
        </Paper>
      </Stack>
    </StorytellerShell>
  );
}
