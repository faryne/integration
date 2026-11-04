import { Link, useLocation } from "react-router-dom";
import { Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";

import { findBackendAdminNavMatch } from "@/data/backendAdminNav.ts";
import { BACKEND_ADMIN_PATH } from "@/helpers/backendAdmin.ts";
import { useBreadcrumbTailValue } from "@/helpers/breadcrumbTail.ts";

const crumbSx = { fontSize: "inherit" };

/** 後台麵包屑：「後台 / 模組 / 功能」由側欄設定推導，動態頁（單筆審核等）用 useBreadcrumbTail 補最後一層 */
export function BackendAdminBreadcrumbs() {
  const { pathname } = useLocation();
  const match = findBackendAdminNavMatch(pathname);
  const tail = useBreadcrumbTailValue();
  const atHome = match?.item.href === BACKEND_ADMIN_PATH;
  const atItemRoot = match && pathname === match.item.href;

  return (
    <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: 13, mb: 1.5 }}>
      {atHome ? (
        <Typography color="text.primary" sx={crumbSx}>
          後台
        </Typography>
      ) : (
        <MuiLink
          color="inherit"
          component={Link}
          to={BACKEND_ADMIN_PATH}
          underline="hover"
        >
          後台
        </MuiLink>
      )}
      {match?.group.title && (
        <Typography sx={crumbSx}>{match.group.title}</Typography>
      )}
      {match &&
        !atHome &&
        (atItemRoot ? (
          <Typography color="text.primary" sx={crumbSx}>
            {match.item.label}
          </Typography>
        ) : (
          <MuiLink
            color="inherit"
            component={Link}
            to={match.item.href}
            underline="hover"
          >
            {match.item.label}
          </MuiLink>
        ))}
      {tail && !atItemRoot && (
        <Typography color="text.primary" sx={crumbSx}>
          {tail}
        </Typography>
      )}
    </Breadcrumbs>
  );
}
