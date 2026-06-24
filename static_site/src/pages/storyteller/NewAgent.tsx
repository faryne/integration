import KeyIcon from "@mui/icons-material/Key";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSaveStorytellerAgent } from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerAgentRequest } from "@/types/storyteller.ts";

export default function StorytellerNewAgent() {
  const navigate = useNavigate();
  const saveAgent = useSaveStorytellerAgent();
  const [input, setInput] = useState<StorytellerAgentRequest>({
    name: "",
    provider: "grok",
    model_name: "",
    api_key: "",
    default_prompt: "",
  });
  useTitle("建立 Storyteller AI Agent", {
    path: "/storyteller/my/agent/new",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="建立 AI Agent"
      description="設定 Agent 名稱、供應商、模型與 API Key。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent", to: "/storyteller/my/agent" },
        { label: "建立 AI Agent" },
      ]}
    >
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          saveAgent.mutate(
            { input },
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
              建立 AI Agent 失敗，請確認登入狀態與欄位內容。
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
                placeholder="填入後端加密保存前的輸入欄位"
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
              {saveAgent.isPending ? "建立中" : "建立 AI Agent"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
