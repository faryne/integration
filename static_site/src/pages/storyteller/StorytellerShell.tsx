import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";

export interface StorytellerBreadcrumbItem {
  label: string;
  to?: string;
}

export function StorytellerShell({
  title,
  description,
  breadcrumbs,
  meta,
  action,
  headerContent,
  hideHeading = false,
  children,
}: {
  title: string;
  // 只在真的有實質內容（例如作品簡介）時才傳入；單純換句話說重複標題的文字不要傳
  description?: ReactNode;
  breadcrumbs: StorytellerBreadcrumbItem[];
  // 狀態／統計 chip 列，固定顯示在標題正下方，跟右側的 action 按鈕區分開
  meta?: ReactNode;
  action?: ReactNode;
  headerContent?: ReactNode;
  hideHeading?: boolean;
  children: ReactNode;
}) {
  return (
    <Stack spacing={3}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 1,
          bgcolor: "background.paper",
          ...steamPanelTopBarSx,
        }}
      >
        <SteamRivets />
        <Stack spacing={2}>
          <Breadcrumbs aria-label={`${STORYTELLER_APP_NAME} breadcrumbs`}>
            {breadcrumbs.map((item, index) =>
              item.to && index < breadcrumbs.length - 1 ? (
                <Link
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  underline="hover"
                  color="inherit"
                >
                  {item.label}
                </Link>
              ) : (
                <Typography key={item.label} color="text.primary">
                  {item.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            {hideHeading ? (
              <Box sx={{ flex: 1 }} />
            ) : (
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography component="h1" variant="h4" fontWeight={800}>
                  {title}
                </Typography>
                {description && (
                  <Typography
                    component="div"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {description}
                  </Typography>
                )}
                {meta && (
                  <Box sx={{ mt: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {meta}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
            {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
          </Stack>
          {headerContent}
        </Stack>
      </Paper>

      {children}
    </Stack>
  );
}

export function StorytellerPrimaryActions() {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button
        component={RouterLink}
        to={steamloomPath("my/project/new")}
        variant="contained"
        startIcon={<AutoStoriesIcon />}
      >
        建立專案
      </Button>
      <Button
        component={RouterLink}
        to={steamloomPath("my/agent/new")}
        variant="outlined"
        startIcon={<SmartToyIcon />}
      >
        建立 AI Agent
      </Button>
    </Stack>
  );
}

export function StorytellerLoading({
  label = "載入中...",
}: {
  label?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
      <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
        <CircularProgress />
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
    </Paper>
  );
}
