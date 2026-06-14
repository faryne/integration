import { Box, Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const basePath = "/data/taipower/neighbor";

interface TaipowerNeighborBreadcrumbProps {
  current?: string;
  parent?: {
    label: string;
    path: string;
  };
}

export function TaipowerNeighborBreadcrumb({
  current,
  parent,
}: TaipowerNeighborBreadcrumbProps) {
  return (
    <Box sx={{ color: "text.secondary", fontSize: 14, minWidth: 0 }}>
      <Breadcrumbs aria-label="taipower neighbor breadcrumb">
        <Typography color="text.secondary">資料</Typography>
        {current || parent ? (
          <Link component={RouterLink} to={basePath} underline="hover">
            台電敦親睦鄰捐助
          </Link>
        ) : (
          <Typography color="text.primary" fontWeight={800}>
            台電敦親睦鄰捐助
          </Typography>
        )}
        {parent && (
          <Link component={RouterLink} to={parent.path} underline="hover">
            {parent.label}
          </Link>
        )}
        {current && (
          <Typography color="text.primary" fontWeight={800}>
            {current}
          </Typography>
        )}
      </Breadcrumbs>
    </Box>
  );
}
