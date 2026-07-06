import KeyIcon from "@mui/icons-material/Key";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  useStorytellerAgentPromptVersions,
  useStorytellerAgentProviderModels,
  useSaveStorytellerAgent,
  useStorytellerAgents,
  useStorytellerProviderAPIKeys,
} from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  StoryEditHistory,
  type StoryEditHistoryItem,
} from "@/pages/storyteller/StoryEditHistory.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerAgentRequest } from "@/types/storyteller.ts";

export default function StorytellerNewAgent() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const editAgentId = agentId ? Number(agentId) : undefined;
  const isEdit = Number.isFinite(editAgentId);
  const {
    data: agents = [],
    isLoading: agentsLoading,
    isFetching: agentsFetching,
  } = useStorytellerAgents();
  const agent = agents.find((item) => item.id === editAgentId);
  const { data: providerModels = [] } = useStorytellerAgentProviderModels();
  const { data: apiKeys = [] } = useStorytellerProviderAPIKeys();
  const { data: promptVersions = [], isLoading: promptVersionsLoading } =
    useStorytellerAgentPromptVersions(editAgentId);
  const saveAgent = useSaveStorytellerAgent();
  const [tab, setTab] = useState("settings");
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const [input, setInput] = useState<StorytellerAgentRequest>({
    name: "",
    provider: "grok",
    model_name: "",
    provider_apikey_id: null,
    default_prompt: "",
  });

  useEffect(() => {
    if (!agent) {
      return;
    }
    setInput({
      name: agent.name,
      provider: agent.provider,
      model_name: agent.model_name,
      provider_apikey_id: agent.provider_apikey_id,
      default_prompt: agent.default_prompt,
    });
  }, [agent]);

  const providerApiKeys = useMemo(
    () => apiKeys.filter((apiKey) => apiKey.provider === input.provider),
    [apiKeys, input.provider],
  );

  useEffect(() => {
    if (input.provider_apikey_id || providerApiKeys.length === 0) {
      return;
    }
    setInput((value) => ({
      ...value,
      provider_apikey_id: providerApiKeys[0].id,
    }));
  }, [input.provider_apikey_id, providerApiKeys]);

  useEffect(() => {
    const currentProvider = providerModels.find(
      (item) => item.provider === input.provider,
    );
    if (
      input.model_name ||
      !currentProvider ||
      currentProvider.models.length === 0
    ) {
      return;
    }
    setInput((value) => ({
      ...value,
      model_name: currentProvider.models[0]?.name ?? "",
    }));
  }, [input.model_name, input.provider, providerModels]);

  const providerOption = providerModels.find(
    (item) => item.provider === input.provider,
  );
  const agentHistoryItems: StoryEditHistoryItem[] = promptVersions.map(
    (version) => ({
      id: String(version.id),
      title: `${version.name} / ${version.model_name}`,
      source: version.provider,
      createdAt: version.created_at,
      words: Array.from(version.default_prompt ?? "").length,
    }),
  );
  const comparePath =
    editAgentId && leftVersionId && rightVersionId
      ? `/storyteller/my/agent/${editAgentId}/diff/${leftVersionId}/${rightVersionId}`
      : "";
  const modelOptions = useMemo(
    () => providerOption?.models ?? [],
    [providerOption?.models],
  );
  const selectedModel = useMemo(
    () => modelOptions.find((model) => model.name === input.model_name),
    [input.model_name, modelOptions],
  );
  const selectedModelPriceItems = useMemo(
    () => modelPriceItems(selectedModel?.price ?? ""),
    [selectedModel?.price],
  );

  useTitle(`${isEdit ? "編輯" : "建立"} Storyteller AI Agent`, {
    path: isEdit
      ? `/storyteller/my/agent/${agentId}/edit`
      : "/storyteller/my/agent/new",
    robots: "noindex, nofollow",
  });

  if (isEdit && !agent && (agentsLoading || agentsFetching)) {
    return (
      <StorytellerShell
        title="編輯 AI Agent"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
          { label: "編輯 AI Agent" },
        ]}
      >
        <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
          <CircularProgress size={28} />
          <Typography color="text.secondary">正在載入 Agent 設定...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (isEdit && !agent) {
    return (
      <StorytellerShell
        title="找不到 AI Agent"
        description="此 Agent 可能不存在或已被刪除。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
          { label: "找不到 AI Agent" },
        ]}
      >
        <Alert severity="error" variant="outlined">
          找不到指定的 AI Agent。
        </Alert>
      </StorytellerShell>
    );
  }

  return (
    <StorytellerShell
      title={isEdit ? "編輯 AI Agent" : "建立 AI Agent"}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent", to: "/storyteller/my/agent" },
        { label: isEdit ? "編輯 AI Agent" : "建立 AI Agent" },
      ]}
    >
      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        {isEdit && (
          <>
            <Tabs value={tab} onChange={(_, value) => setTab(value)}>
              <Tab value="settings" label="設定" />
              <Tab value="history" label="編輯歷史" />
            </Tabs>
            <Divider />
          </>
        )}
        {tab === "history" && isEdit ? (
          <Stack sx={{ p: { xs: 2, md: 3 } }}>
            <StoryEditHistory
              items={agentHistoryItems}
              loading={promptVersionsLoading}
              leftVersionId={leftVersionId}
              rightVersionId={rightVersionId}
              comparePath={comparePath}
              onLeftVersionChange={setLeftVersionId}
              onRightVersionChange={setRightVersionId}
              isRightVersionDisabled={(versionId) =>
                Boolean(
                  leftVersionId && Number(versionId) <= Number(leftVersionId),
                )
              }
              newItemMessage="建立或更新 AI Agent 後才會產生 Prompt 編輯歷史。"
              helperMessage="請依序選擇要比對的新舊 Prompt 版本後再按下「比對選取版本」。"
            />
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={3}
            sx={{ p: { xs: 2, md: 3 } }}
            onSubmit={(event) => {
              event.preventDefault();
              saveAgent.mutate(
                { id: editAgentId, input },
                {
                  onSuccess: () => {
                    navigate("/storyteller/my/agent");
                  },
                },
              );
            }}
          >
            {saveAgent.isError && (
              <Alert severity="error" variant="outlined">
                {isEdit ? "更新" : "建立"} AI Agent
                失敗，請確認登入狀態與欄位內容。
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  required
                  fullWidth
                  label="Agent 名稱"
                  placeholder="例如：Plot Doctor"
                  value={input.name}
                  onChange={(event) =>
                    setInput((value) => ({
                      ...value,
                      name: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  required
                  fullWidth
                  select
                  label="AI 供應商"
                  value={input.provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    const nextOption = providerModels.find(
                      (item) => item.provider === nextProvider,
                    );
                    setInput((value) => ({
                      ...value,
                      provider: nextProvider,
                      model_name: nextOption?.models[0]?.name ?? "",
                      provider_apikey_id: null,
                    }));
                  }}
                >
                  {providerModels.map((provider) => (
                    <MenuItem key={provider.provider} value={provider.provider}>
                      {provider.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                {modelOptions.length > 0 ? (
                  <TextField
                    required
                    fullWidth
                    select
                    label="模型名稱"
                    value={input.model_name}
                    onChange={(event) =>
                      setInput((value) => ({
                        ...value,
                        model_name: event.target.value,
                      }))
                    }
                  >
                    {modelOptions.map((model) => (
                      <MenuItem key={model.name} value={model.name}>
                        {model.label}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : providerOption?.allow_custom_model ? (
                  <TextField
                    required
                    fullWidth
                    label="模型名稱"
                    placeholder="例如：openai/gpt-4.1"
                    value={input.model_name}
                    onChange={(event) =>
                      setInput((value) => ({
                        ...value,
                        model_name: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <TextField
                    required
                    fullWidth
                    select
                    label="模型名稱"
                    value={input.model_name}
                    onChange={(event) =>
                      setInput((value) => ({
                        ...value,
                        model_name: event.target.value,
                      }))
                    }
                  >
                    {modelOptions.map((model) => (
                      <MenuItem key={model.name} value={model.name}>
                        {model.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Grid>
              {selectedModel &&
                (selectedModel.description ||
                  selectedModelPriceItems.length > 0) && (
                  <Grid size={12}>
                    <Alert severity="info" variant="outlined">
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">
                          {selectedModel.label}
                        </Typography>
                        {selectedModel.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: "pre-line" }}
                          >
                            {selectedModel.description}
                          </Typography>
                        )}
                        {selectedModelPriceItems.length > 0 && (
                          <Stack spacing={0.5}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              費用參考
                            </Typography>
                            {selectedModelPriceItems.map((item) => (
                              <Typography
                                key={item.key}
                                variant="body2"
                                color="text.secondary"
                              >
                                {item.label}：{item.value}
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </Alert>
                  </Grid>
                )}
              <Grid size={12}>
                {providerApiKeys.length > 0 ? (
                  <TextField
                    required
                    fullWidth
                    select
                    label="API Key"
                    helperText="從金鑰管理建立的金鑰中選擇此 Agent 預設使用的金鑰。"
                    value={input.provider_apikey_id ?? ""}
                    onChange={(event) =>
                      setInput((value) => ({
                        ...value,
                        provider_apikey_id: Number(event.target.value),
                      }))
                    }
                    slotProps={{
                      input: {
                        startAdornment: (
                          <KeyIcon color="disabled" sx={{ mr: 1 }} />
                        ),
                      },
                    }}
                  >
                    {providerApiKeys.map((apiKey) => (
                      <MenuItem key={apiKey.id} value={apiKey.id}>
                        {apiKey.label || `金鑰 #${apiKey.id}`}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Alert
                    severity="warning"
                    variant="outlined"
                    action={
                      <Button
                        component={RouterLink}
                        to="/storyteller/my/api-keys"
                        size="small"
                      >
                        前往新增
                      </Button>
                    }
                  >
                    此供應商尚未建立任何 API Key，請先到金鑰管理新增一把。
                  </Alert>
                )}
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={5}
                  label="Agent 預設 prompt"
                  placeholder="描述此 Agent 適合做什麼，例如續寫、改寫、世界觀校對或章節節奏分析。"
                  value={input.default_prompt}
                  onChange={(event) =>
                    setInput((value) => ({
                      ...value,
                      default_prompt: event.target.value,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button href="/storyteller/my/agent" variant="text">
                返回列表
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saveAgent.isPending}
              >
                {saveAgent.isPending
                  ? isEdit
                    ? "更新中"
                    : "建立中"
                  : isEdit
                    ? "更新 AI Agent"
                    : "建立 AI Agent"}
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    </StorytellerShell>
  );
}

const modelPriceLabels: Record<string, string> = {
  prompt: "輸入 token",
  completion: "輸出 token",
  image: "圖片",
  audio: "音訊",
  web_search: "網路搜尋",
  input_cache_read: "快取讀取",
  input_cache_write: "快取寫入",
  internal_reasoning: "內部推理",
};

function modelPriceItems(price: string) {
  if (!price.trim()) {
    return [];
  }
  try {
    // 將同步回來的 pricing JSON 轉成可掃讀的費用欄位，避免在 UI 顯示原始 JSON。
    const parsed = JSON.parse(price) as Record<string, string | number | null>;
    return Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== "")
      .map(([key, value]) => ({
        key,
        label: modelPriceLabels[key] ?? key,
        value: String(value),
      }));
  } catch {
    return [{ key: "raw", label: "價格", value: price }];
  }
}
