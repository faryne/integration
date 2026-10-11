import { Box, Breadcrumbs, Link, Typography } from "@mui/material";

export type Crumb = { label: string; onClick?: () => void };

// 頁面頂部的麵包屑列；最後一項是目前位置（強調色），有 onClick 的項目可以點回去。
export function AppBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Box sx={{ height: 44, px: 2.25, display: "flex", alignItems: "center", borderBottom: 1, borderColor: "divider", flex: "none" }}>
      <Breadcrumbs>
        {items.map((item, index) =>
          index === items.length - 1 ? (
            <Typography key={index} color="primary" fontWeight={500} noWrap>
              {item.label}
            </Typography>
          ) : (
            <Link
              key={index}
              component="button"
              underline="hover"
              color="text.secondary"
              onClick={item.onClick}
              disabled={!item.onClick}
              sx={{ cursor: item.onClick ? "pointer" : "default" }}
            >
              {item.label}
            </Link>
          ),
        )}
      </Breadcrumbs>
    </Box>
  );
}
