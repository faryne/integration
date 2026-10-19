import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useStorytellerAuditArchiveMonths } from "@/apis/storyteller/audit.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerAuditArchivePanel } from "@/pages/storyteller/StorytellerAuditArchivePanel.tsx";
import { StorytellerAuditEventList } from "@/pages/storyteller/StorytellerAuditEventList.tsx";

// 活動紀錄：本人的所有操作（網頁編輯、MCP 讀寫（Personal Access Token／OAuth）、登入與憑證、AI 助理），
// 分成「近期（MySQL）」與「封存（Athena）」兩種模式，不混在同一個列表裡分頁。
// 協作還沒上線，專案裡的操作只可能是本人，所以不另做專案層的稽核頁。
export function StorytellerAccountActivityPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"recent" | "archive">("recent");
  const months = useStorytellerAuditArchiveMonths();
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
            {t("web.audit.panel.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("web.audit.panel.description")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            component={RouterLink}
            to={steamloomPath("my/mcp")}
            size="small"
            variant="outlined"
          >
            {t("web.audit.panel.developerSettings")}
          </Button>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, value) => value && setMode(value)}
          >
            <ToggleButton value="recent">
              {t("web.audit.panel.recent")}
            </ToggleButton>
            <ToggleButton value="archive">
              {t("web.audit.panel.archive")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      {mode === "recent" ? (
        <>
          <Alert severity="info">{t("web.audit.panel.asyncNotice")}</Alert>
          <StorytellerAuditEventList
            onSwitchToArchive={() => setMode("archive")}
          />
        </>
      ) : months.data ? (
        <StorytellerAuditArchivePanel months={months.data} />
      ) : months.isError ? (
        <Alert severity="error">{t("web.audit.panel.errors.months")}</Alert>
      ) : (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
    </Stack>
  );
}
