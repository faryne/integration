import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import {
  GalgameBreadcrumb,
  type GalgameBreadcrumbProps,
} from "@/components/galgame/GalgameBreadcrumb.tsx";

interface GalgamePageHeaderProps extends GalgameBreadcrumbProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** 所有 galgame 頁面共用的頁首：麵包屑＋標題（可選）＋右側操作，確保每頁都有麵包屑 */
export function GalgamePageHeader({
  title,
  subtitle,
  actions,
  ...breadcrumb
}: GalgamePageHeaderProps) {
  return (
    <Box sx={{ mb: title ? 3 : 0 }}>
      <GalgameBreadcrumb {...breadcrumb} />
      {title && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h1" fontWeight={800}>
              {title}
            </Typography>
            {subtitle && (
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions}
        </Stack>
      )}
    </Box>
  );
}
