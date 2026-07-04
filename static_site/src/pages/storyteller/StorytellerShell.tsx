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

export interface StorytellerBreadcrumbItem {
  label: string;
  to?: string;
}

export function StorytellerShell({
  title,
  description,
  breadcrumbs,
  action,
  headerContent,
  hideHeading = false,
  children,
}: {
  title: string;
  description: ReactNode;
  breadcrumbs: StorytellerBreadcrumbItem[];
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
        }}
      >
        <Stack spacing={2}>
          <Breadcrumbs aria-label="Storyteller breadcrumbs">
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
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h1" variant="h4" fontWeight={800}>
                  {title}
                </Typography>
                <Typography
                  component="div"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {description}
                </Typography>
              </Box>
            )}
            {action}
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
        to="/storyteller/my/project/new"
        variant="contained"
        startIcon={<AutoStoriesIcon />}
      >
        建立專案
      </Button>
      <Button
        component={RouterLink}
        to="/storyteller/my/agent/new"
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
