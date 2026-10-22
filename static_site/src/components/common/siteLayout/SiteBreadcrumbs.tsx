import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Container,
  Link as MuiLink,
  Typography,
} from "@mui/material";

import { findSiteNavigationMatch } from "@/helpers/siteNavigation.ts";

/** header 下方的 breadcrumb：由導覽資料推導「首頁 / 分類 / 功能」，不在導覽裡的頁面不顯示 */
export function SiteBreadcrumbs() {
  const { pathname } = useLocation();
  const match = findSiteNavigationMatch(pathname);
  if (!match) return null;

  // 在功能的子路徑時（例如 /data/tw-stats/人口），功能名稱可點回功能首頁
  const atItemRoot = pathname === match.item.href;
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
            首頁
          </MuiLink>
          <Typography sx={{ fontSize: "inherit" }}>
            {match.group.title}
          </Typography>
          {atItemRoot ? (
            <Typography
              sx={{ fontSize: "inherit", fontWeight: 600 }}
              color="text.primary"
            >
              {match.item.title}
            </Typography>
          ) : (
            <MuiLink
              component={Link}
              to={match.item.href}
              color="inherit"
              underline="hover"
            >
              {match.item.title}
            </MuiLink>
          )}
        </Breadcrumbs>
      </Container>
    </Box>
  );
}
