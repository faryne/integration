import { Box, Container, Typography } from "@mui/material";

import type { LayoutDropMenu, LayoutMenuItem } from "@/types/layout.ts";

import { ExternalMark, SiteNavLink } from "./SiteNavLink.tsx";
import { siteInk } from "./siteTheme.ts";

interface SiteMegaMenuProps {
  menu: LayoutDropMenu;
  current?: LayoutMenuItem;
  onClose: () => void;
}

/** 桌機版下拉：整列展開，列出分類內每個功能與 description */
export function SiteMegaMenu({ menu, current, onClose }: SiteMegaMenuProps) {
  return (
    <Box
      sx={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: siteInk.panel,
        borderBottom: `1px solid ${siteInk.line}`,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
        color: siteInk.text,
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1280,
          py: 2.5,
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 3.5,
        }}
      >
        <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
          {menu.title}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 0.75,
          }}
        >
          {menu.items.map((item) => {
            const here = item === current;
            return (
              <SiteNavLink
                key={item.title}
                item={item}
                onClick={onClose}
                sx={{
                  display: "block",
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: here
                    ? "rgba(114, 255, 240, 0.4)"
                    : "transparent",
                  bgcolor: here ? "rgba(114, 255, 240, 0.1)" : undefined,
                  "&:hover": {
                    bgcolor: siteInk.hover,
                    borderColor: "rgba(114, 255, 240, 0.25)",
                  },
                }}
              >
                <Typography
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    color: here ? siteInk.glow : undefined,
                  }}
                >
                  {item.title}
                  {item.external && <ExternalMark />}
                </Typography>
                {item.description && (
                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 12,
                      lineHeight: 1.55,
                      color: siteInk.textMuted,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.description}
                  </Typography>
                )}
              </SiteNavLink>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}
