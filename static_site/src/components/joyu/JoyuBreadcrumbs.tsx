import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Container,
  Link as MuiLink,
  Typography,
} from "@mui/material";

import { useBreadcrumbTailValue } from "@/helpers/breadcrumbTail.ts";
import { JOYU_SITE_NAME } from "@/helpers/joyu.ts";

import { findJoyuSection, joyuSubPages } from "./joyuNavigation.ts";

const currentSx = { fontSize: "inherit", fontWeight: 600 };

/** joyu.fyi 麵包屑：「joyu.fyi / 區塊 / 子頁或動態頁名稱」；動態頁的最後一層由頁面用 useBreadcrumbTail 補上 */
export function JoyuBreadcrumbs() {
  const { pathname } = useLocation();
  const section = findJoyuSection(pathname);
  const tail = useBreadcrumbTailValue();
  const subPage = joyuSubPages[pathname];
  if (!section) return null;

  // 在區塊首頁且沒有更深一層時，區塊名稱就是目前位置，不做成連結
  const atSectionRoot = pathname === section.href && !tail;
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1280, py: 1 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: 13 }}>
          <MuiLink component={Link} to="/" color="inherit" underline="hover">
            {JOYU_SITE_NAME}
          </MuiLink>
          {atSectionRoot ? (
            <Typography sx={currentSx} color="text.primary">
              {section.title}
            </Typography>
          ) : (
            <MuiLink
              component={Link}
              to={section.href}
              color="inherit"
              underline="hover"
            >
              {section.title}
            </MuiLink>
          )}
          {(subPage || tail) && (
            <Typography
              noWrap
              sx={{ ...currentSx, maxWidth: { xs: 180, sm: 480, md: 720 } }}
              color="text.primary"
              title={subPage ?? tail}
            >
              {subPage ?? tail}
            </Typography>
          )}
        </Breadcrumbs>
      </Container>
    </Box>
  );
}
