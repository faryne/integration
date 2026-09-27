import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import {
  Alert,
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { StorytellerAuditEventList } from "@/pages/storyteller/StorytellerAuditEventList.tsx";

// 專案稽核頁：外框、近期／封存切換與非同步寫入提示；列表本體與帳號活動頁共用。
// 封存查詢（3 個月以前）在 P4 才開放，這裡先保留切換鈕但停用，讓使用者知道之後會有。
export function StorytellerProjectAuditPage({
  projectPublicId,
}: {
  projectPublicId?: string;
}) {
  return (
    <Stack
      spacing={2.5}
      sx={{ maxWidth: 1120, mx: "auto", p: { xs: 2, md: 4 } }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryOutlinedIcon color="primary" />
            <Typography
              variant="overline"
              color="primary.main"
              fontWeight={800}
            >
              專案安全
            </Typography>
          </Stack>
          <Typography
            component="h1"
            variant="h4"
            fontWeight={900}
            sx={{ mt: 0.5 }}
          >
            稽核紀錄
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            查看這個專案裡誰在什麼時候、從哪裡做了哪些操作。
          </Typography>
        </Box>
        <ToggleButtonGroup size="small" exclusive value="recent">
          <ToggleButton value="recent">近期</ToggleButton>
          <Tooltip title="3 個月以前的紀錄查詢即將開放">
            <span>
              <ToggleButton value="archive" disabled>
                封存
              </ToggleButton>
            </span>
          </Tooltip>
        </ToggleButtonGroup>
      </Stack>
      <Alert severity="info">
        稽核紀錄是非同步寫入的，最近幾秒內的操作可能還沒出現，稍後重新整理即可。
      </Alert>
      <StorytellerAuditEventList
        scope="project"
        projectPublicId={projectPublicId}
      />
    </Stack>
  );
}
