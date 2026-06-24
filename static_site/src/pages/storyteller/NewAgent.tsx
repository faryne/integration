import KeyIcon from "@mui/icons-material/Key";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useSaveStorytellerAgent,
  useStorytellerAgents,
} from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerAgentRequest } from "@/types/storyteller.ts";

export default function StorytellerNewAgent() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const editAgentId = agentId ? Number(agentId) : undefined;
  const isEdit = Number.isFinite(editAgentId);
  const { data: agents = [], isLoading: agentsLoading } =
    useStorytellerAgents();
  const agent = agents.find((item) => item.id === editAgentId);
  const saveAgent = useSaveStorytellerAgent();
  const [input, setInput] = useState<StorytellerAgentRequest>({
    name: "",
    provider: "grok",
    model_name: "",
    api_key: "",
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
      api_key: "",
      default_prompt: agent.default_prompt,
    });
  }, [agent]);

  useTitle(`${isEdit ? "編輯" : "建立"} Storyteller AI Agent`, {
    path: isEdit
      ? `/storyteller/my/agent/${agentId}/edit`
      : "/storyteller/my/agent/new",
    robots: "noindex, nofollow",
  });

  if (isEdit && agentsLoading) {
    return (
      <StorytellerShell
        title="編輯 AI Agent"
        description="正在載入 Agent 設定。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
          { label: "編輯 AI Agent" },
        ]}
      >
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
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
      description="設定 Agent 名稱、供應商、模型與 API Key。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent", to: "/storyteller/my/agent" },
        { label: isEdit ? "編輯 AI Agent" : "建立 AI Agent" },
      ]}
    >
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
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
        <Stack spacing={3}>
          {saveAgent.isError && (
            <Alert severity="error" variant="outlined">
              {isEdit ? "更新" : "建立"} AI Agent
              失敗，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="Agent 名稱"
                placeholder="例如：Plot Doctor"
                value={input.name}
                onChange={(event) =>
                  setInput((value) => ({ ...value, name: event.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
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
                <MenuItem value="grok">Grok</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="模型名稱"
                placeholder="例如：grok-4"
                value={input.model_name}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    model_name: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="password"
                label="API Key"
                placeholder={
                  isEdit
                    ? "留空代表沿用既有 API Key"
                    : "填入後端加密保存前的輸入欄位"
                }
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
      </Paper>
    </StorytellerShell>
  );
}
