import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  FormHelperText,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerNewProject() {
  const [submitted, setSubmitted] = useState(false);
  useTitle("建立 Storyteller 專案", {
    path: "/storyteller/project/new",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="建立專案"
      description="填寫故事企劃的基本資訊。送出行為會在後端 API 完成後串接。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表", to: "/storyteller/project" },
        { label: "建立專案" },
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
              目前僅完成畫面，尚未串接建立專案 API。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="專案名稱"
                placeholder="例如：河燈之城"
                helperText="不可與既有專案重複。"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="專案特殊網址"
                placeholder="例如：river-lantern"
                helperText="可留空由系統產生；限中英數，不得使用符號。"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={5}
                label="專案描述"
                placeholder="記錄故事類型、核心題材、世界觀與目前預計的寫作方向。"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth select label="預設狀態" defaultValue="planning">
                <MenuItem value="planning">規劃中</MenuItem>
                <MenuItem value="drafting">撰寫中</MenuItem>
                <MenuItem value="paused">暫停</MenuItem>
              </TextField>
              <FormHelperText>先作為前端顯示欄位，後續可依資料表調整。</FormHelperText>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button href="/storyteller/project" variant="text">
              返回列表
            </Button>
            <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
              建立專案
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
