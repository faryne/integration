import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useStorytellerAuditArchiveMonths } from "@/apis/storyteller/audit.ts";
import { StorytellerAuditArchivePanel } from "@/pages/storyteller/StorytellerAuditArchivePanel.tsx";
import { StorytellerAuditEventList } from "@/pages/storyteller/StorytellerAuditEventList.tsx";

// 專案稽核頁：同一頁分成「近期（MySQL）」與「封存（Athena）」兩種查詢模式，
// 兩者不混在同一個列表裡分頁；列表列與事件詳情兩邊共用。
export function StorytellerProjectAuditPage({
  projectPublicId,
}: {
  projectPublicId?: string;
}) {
  const [mode, setMode] = useState<"recent" | "archive">("recent");
  const months = useStorytellerAuditArchiveMonths(projectPublicId);
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, value) => value && setMode(value)}
        >
          <ToggleButton value="recent">近期</ToggleButton>
          <ToggleButton value="archive">封存</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {mode === "recent" ? (
        <>
          <Alert severity="info">
            稽核紀錄是非同步寫入的，最近幾秒內的操作可能還沒出現，稍後重新整理即可。
          </Alert>
          <StorytellerAuditEventList
            scope="project"
            projectPublicId={projectPublicId}
          />
        </>
      ) : months.data ? (
        <StorytellerAuditArchivePanel
          projectPublicId={projectPublicId}
          months={months.data}
        />
      ) : months.isError ? (
        <Alert severity="error">封存月份載入失敗，請稍後再試。</Alert>
      ) : (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
    </Stack>
  );
}
