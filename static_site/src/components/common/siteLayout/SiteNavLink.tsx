import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SxProps, Theme } from "@mui/material";
import { Box } from "@mui/material";
import NorthEastIcon from "@mui/icons-material/NorthEast";

import type { LayoutMenuItem } from "@/types/layout.ts";

interface SiteNavLinkProps {
  item: LayoutMenuItem;
  children?: ReactNode;
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

/** 導覽連結共用：站內走 router Link，外站開新分頁 */
export function SiteNavLink({ item, children, onClick, sx }: SiteNavLinkProps) {
  const style = [
    { color: "inherit", textDecoration: "none" },
    ...(Array.isArray(sx) ? sx : [sx]),
  ];
  return item.external ? (
    <Box
      component="a"
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      sx={style}
    >
      {children ?? item.title}
    </Box>
  ) : (
    <Box component={Link} to={item.href} onClick={onClick} sx={style}>
      {children ?? item.title}
    </Box>
  );
}

/** 外站連結標示 ↗ */
export function ExternalMark() {
  return <NorthEastIcon sx={{ fontSize: 12, opacity: 0.65, ml: 0.5 }} />;
}
