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
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import {
  STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES,
  storytellerMascotLoadingSpriteSrc,
} from "@/helpers/storytellerMascot.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";

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
  plain = false,
  fitHeight = false,
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
  plain?: boolean;
  fitHeight?: boolean;
  children: ReactNode;
}) {
  const header = (
    <Stack spacing={2}>
      {breadcrumbs.length > 0 && (
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
      )}

      {(!hideHeading || action) && (
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
              <Typography
                component="h1"
                variant="h3"
                fontWeight={800}
                sx={{ letterSpacing: "-0.035em" }}
              >
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
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {meta}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
      )}
      {headerContent}
    </Stack>
  );

  if (plain) {
    return (
      <Stack
        spacing={fitHeight ? 1.5 : 3}
        sx={{ height: fitHeight ? 1 : undefined, minHeight: 0 }}
      >
        <Box sx={{ flexShrink: 0 }}>{header}</Box>
        <Box sx={{ flex: fitHeight ? 1 : undefined, minHeight: 0 }}>
          {children}
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <Box
        sx={{
          px: { xs: 1, md: 2 },
          pt: { xs: 1, md: 2 },
          pb: { xs: 2.5, md: 3 },
          borderBottom: "1px solid",
          borderColor: "divider",
          ...steamPanelTopBarSx,
        }}
      >
        {header}
      </Box>

      {children}
    </Stack>
  );
}

export function StorytellerPrimaryActions() {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button
        component={RouterLink}
        to={steamloomPath("my/projects/new")}
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
  const { appearance } = useStorytellerAppearance();
  const frameSize = 40;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
      <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
        <Box
          sx={{
            position: "relative",
            display: "grid",
            width: 56,
            height: 56,
            placeItems: "center",
          }}
        >
          <CircularProgress size={56} />
          {/* 三幀捲線動作疊在轉圈中央，保留原本 loading 狀態的辨識度。 */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              width: frameSize,
              height: frameSize,
              backgroundImage: `url(${storytellerMascotLoadingSpriteSrc(appearance)})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${frameSize * STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES}px ${frameSize}px`,
              animation: `storyteller-mascot-loading 0.9s steps(${STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES}) infinite`,
              pointerEvents: "none",
              "@keyframes storyteller-mascot-loading": {
                from: { backgroundPositionX: "0px" },
                to: {
                  backgroundPositionX: `-${frameSize * STORYTELLER_MASCOT_LOADING_SPRITE_FRAMES}px`,
                },
              },
            }}
          />
        </Box>
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
    </Paper>
  );
}
