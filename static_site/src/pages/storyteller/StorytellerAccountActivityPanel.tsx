import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerAuditEventList } from "@/pages/storyteller/StorytellerAuditEventList.tsx";

// 帳號活動：登入、憑證與 API key 等帳號層事件，加上所有透過 PAT 的讀寫；
// 選定某支 PAT 就能回答「這支 token 讀了什麼、改了什麼」。
export function StorytellerAccountActivityPanel() {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800}>
            帳號活動
          </Typography>
          <Typography variant="body2" color="text.secondary">
            登入、PAT 與 API key 的安全事件，以及所有透過 PAT 的讀取與修改。
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to={steamloomPath("my/mcp")}
          variant="outlined"
        >
          前往 MCP 與 PAT 管理
        </Button>
      </Stack>
      <Alert severity="info">
        想確認某支 PAT
        做過什麼？在下方的「PAT」篩選選取它，就能列出它所有的讀取、修改與被拒絕的紀錄。
      </Alert>
      <StorytellerAuditEventList scope="account" />
    </Stack>
  );
}
