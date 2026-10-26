import AddIcon from "@mui/icons-material/Add";
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { LanguageMenu } from "@/components/common/LanguageMenu.tsx";
import { GalgameSearchBox } from "@/components/galgame/layout/GalgameSearchBox.tsx";
import { GalgameSubmitMenu } from "@/components/galgame/layout/GalgameSubmitMenu.tsx";
import { GalgameUserMenu } from "@/components/galgame/layout/GalgameUserMenu.tsx";
import {
  galgameNavItems,
  isGalgameNavActive,
} from "@/components/galgame/layout/galgameNavigation.ts";
import { galgamePath } from "@/helpers/galgame.ts";
import { MASCOT_ASSET_CDN_BASE } from "@/helpers/mascotAssets.ts";

/**
 * 頂部列：中性底色，主色只留給互動元件。
 * md 以上：Logo｜3 個主要入口｜搜尋框｜＋ 投稿｜語系｜頭像；
 * md 以下：導覽改由 GalgameBottomNav 負責，搜尋框移到第二列常駐。
 */
export function GalgameHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [submitAnchor, setSubmitAnchor] = useState<HTMLElement | null>(null);

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <Stack
            component={RouterLink}
            to={galgamePath()}
            title="Galgame TV — https://galgame.tv/"
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ color: "inherit", textDecoration: "none", flexShrink: 0 }}
          >
            <Box
              component="img"
              src={`${MASCOT_ASSET_CDN_BASE}/site-icons/galgame-icon.webp`}
              alt=""
              width={32}
              height={32}
              sx={{ borderRadius: 1, flexShrink: 0 }}
            />
            <Typography variant="h6" component="span" fontWeight={800} noWrap>
              Galgame TV
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            {galgameNavItems.map((item) => {
              const active = isGalgameNavActive(pathname, item.path);
              return (
                <Button
                  key={item.key}
                  component={RouterLink}
                  to={galgamePath(item.path)}
                  size="small"
                  color={active ? "primary" : "inherit"}
                  sx={{
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                    px: 1.5,
                    bgcolor: active ? "action.selected" : undefined,
                  }}
                >
                  {t(`galgame.layout.nav.${item.key}`)}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ flex: 1, display: { xs: "none", md: "flex" } }}>
            <GalgameSearchBox />
          </Box>

          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ ml: "auto" }}
          >
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<AddIcon />}
              onClick={(event) => setSubmitAnchor(event.currentTarget)}
              sx={{
                display: { xs: "none", md: "inline-flex" },
                borderRadius: 999,
                borderColor: "divider",
                whiteSpace: "nowrap",
              }}
            >
              {t("galgame.layout.nav.submit")}
            </Button>
            <LanguageMenu />
            <GalgameUserMenu />
          </Stack>
        </Toolbar>
        <Box sx={{ display: { xs: "flex", md: "none" }, pb: 1.5 }}>
          <GalgameSearchBox />
        </Box>
      </Container>
      <GalgameSubmitMenu
        anchorEl={submitAnchor}
        onClose={() => setSubmitAnchor(null)}
      />
    </AppBar>
  );
}
