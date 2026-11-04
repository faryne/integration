import { Box, Chip, Stack, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";

import { useBackendAdminPendingCounts } from "@/apis/backendAdmin/pendingCounts.ts";
import { ExternalMark } from "@/components/common/siteLayout/SiteNavLink.tsx";
import {
  backendAdminNav,
  type BackendAdminNavItem,
} from "@/data/backendAdminNav.ts";
import { BACKEND_ADMIN_PATH } from "@/helpers/backendAdmin.ts";

const itemSx = {
  alignItems: "center",
  borderRadius: 1,
  color: "text.primary",
  display: "flex",
  fontSize: 14,
  fontWeight: 700,
  gap: 1,
  justifyContent: "space-between",
  px: 1.5,
  py: 1,
  textDecoration: "none",
  whiteSpace: "nowrap",
  "&:hover": { bgcolor: "action.hover" },
  "&.active": { bgcolor: "action.selected", color: "primary.main" },
};

/** 後台側欄：依 backendAdminNav 分組列出，待處理數量顯示在項目旁；onNavigate 給手機 Drawer 點完收起 */
export function BackendAdminSideNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const counts = useBackendAdminPendingCounts();
  return (
    <Stack component="nav" aria-label="後台導覽" spacing={1.5} sx={{ p: 1 }}>
      {backendAdminNav.map((group, i) => (
        <Box key={group.title ?? i}>
          {group.title && (
            <Typography
              color="text.secondary"
              fontWeight={800}
              sx={{ display: "block", px: 1.5, py: 0.5 }}
              variant="caption"
            >
              {group.title}
            </Typography>
          )}
          {group.items.map((item) => (
            <NavItem
              count={item.badge ? counts[item.badge] : undefined}
              item={item}
              key={item.href}
              onNavigate={onNavigate}
            />
          ))}
        </Box>
      ))}
    </Stack>
  );
}

function NavItem({
  item,
  count,
  onNavigate,
}: {
  item: BackendAdminNavItem;
  count?: number;
  onNavigate?: () => void;
}) {
  if (item.external)
    return (
      <Box
        component="a"
        href={item.href}
        rel="noopener"
        sx={itemSx}
        target="_blank"
      >
        <span>
          {item.label}
          <ExternalMark />
        </span>
      </Box>
    );
  return (
    <Box
      component={NavLink}
      // 總覽只在完全相等時亮，其他項目子路徑（例如單筆審核）也算在內
      end={item.href === BACKEND_ADMIN_PATH}
      onClick={onNavigate}
      sx={itemSx}
      to={item.href}
    >
      {item.label}
      {Boolean(count) && (
        <Chip color="error" label={count} size="small" sx={{ height: 20 }} />
      )}
    </Box>
  );
}
