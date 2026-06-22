import KeyIcon from "@mui/icons-material/Key";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerNewAgent() {
  const [submitted, setSubmitted] = useState(false);
  useTitle("建立 Storyteller AI Agent", {
    path: "/storyteller/agent/new",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="建立 AI Agent"
      description="設定 Agent 名稱、供應商、模型與 API Key。此階段先完成表單畫面。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent 列表", to: "/storyteller/agent" },
        { label: "建立 AI Agent" },
      ]}
    >
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <Stack spacing={3}>
          {submitted && (
            <Alert severity="info" variant="outlined">
              目前僅完成畫面，尚未串接建立 AI Agent API。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="Agent 名稱"
                placeholder="例如：Plot Doctor"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField required fullWidth select label="AI 供應商" defaultValue="grok">
                <MenuItem value="grok">Grok</MenuItem>
                <MenuItem value="openai-compatible">OpenAI compatible</MenuItem>
                <MenuItem value="custom">其他</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="模型名稱"
                placeholder="例如：grok-4"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="password"
                label="API Key"
                placeholder="填入後端加密保存前的輸入欄位"
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
                label="Agent 用途"
                placeholder="描述此 Agent 適合做什麼，例如續寫、改寫、世界觀校對或章節節奏分析。"
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="建立後立即啟用"
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button href="/storyteller/agent" variant="text">
              返回列表
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
              建立 AI Agent
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
