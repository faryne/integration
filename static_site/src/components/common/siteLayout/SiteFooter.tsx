import { Box, Container, Link as MuiLink, Typography } from "@mui/material";

import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import type { LayoutMenuItem } from "@/types/layout.ts";

import { ExternalMark, SiteNavLink } from "./SiteNavLink.tsx";
import { FooterMascotLinks } from "./FooterMascotLinks.tsx";
import { siteInk } from "./siteTheme.ts";

// 第一欄放沒有子選單的直接連結，其餘每個分類一欄
const columns = [
  {
    title: "主要連結",
    items: headerNavigationItems.filter(
      (n): n is LayoutMenuItem => !isLayoutDropMenu(n),
    ),
  },
  ...headerNavigationItems.filter(isLayoutDropMenu),
];

/** faryne.dev 共用 footer：墨色底，首頁與內頁共用 */
export function SiteFooter() {
  return (
    <Box
      component="footer"
      // mt: 0 蓋掉 common.css 對 footer 元素的舊 margin
      sx={{
        flexShrink: 0,
        mt: 0,
        background: siteInk.footer,
        borderTop: `1px solid ${siteInk.line}`,
        color: siteInk.textMuted,
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1280,
          py: { xs: 3, md: 3.5 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "220px 1fr" },
          gap: { xs: 2.5, md: 4 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            alignItems: { xs: "center", md: "flex-start" },
            justifyContent: { xs: "space-between", md: "flex-start" },
            gap: { xs: 0.5, md: 1.25 },
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <Box>
            Powered By Faryne
            <br />
            <MuiLink
              href="https://faryne.dev/"
              sx={{ color: siteInk.text, textDecorationColor: siteInk.glow }}
            >
              faryne.dev
            </MuiLink>
          </Box>
          <FooterMascotLinks />
        </Box>
        <Box
          component="nav"
          aria-label="footer navigation"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 2.5,
          }}
        >
          {columns.map((col) => (
            <Box key={col.title}>
              <Typography
                sx={{
                  mb: 1,
                  fontSize: 12.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: siteInk.text,
                }}
              >
                {col.title}
              </Typography>
              {col.items.map((item) => (
                <SiteNavLink
                  key={item.title}
                  item={item}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    py: 0.4,
                    fontSize: 13,
                    "&:hover": { color: siteInk.glow },
                  }}
                >
                  {item.title}
                  {item.external && <ExternalMark />}
                </SiteNavLink>
              ))}
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
