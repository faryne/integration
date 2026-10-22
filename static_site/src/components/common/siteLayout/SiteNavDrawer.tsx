import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Drawer,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import type { SiteNavigationMatch } from "@/helpers/siteNavigation.ts";

import { ExternalMark, SiteNavLink } from "./SiteNavLink.tsx";
import { siteInk } from "./siteTheme.ts";

interface SiteNavDrawerProps {
  open: boolean;
  match: SiteNavigationMatch | null;
  onClose: () => void;
}

/** 手機版導覽：各分類可展開，目前所在分類預設展開 */
export function SiteNavDrawer({ open, match, onClose }: SiteNavDrawerProps) {
  const topLinkSx = {
    display: "flex",
    alignItems: "center",
    py: 1.75,
    fontWeight: 700,
    borderBottom: `1px solid ${siteInk.line}`,
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // 壓在 header 底下，讓 header 的 ✕ 一直看得到、可以關閉
      sx={{ zIndex: (theme) => theme.zIndex.appBar - 1 }}
      slotProps={{
        paper: {
          sx: {
            top: 56,
            height: "calc(100% - 56px)",
            // Drawer Paper 預設 content-box，內距會撐出螢幕外
            boxSizing: "border-box",
            width: "min(100vw, 360px)",
            px: 2,
            pt: 1,
            bgcolor: "#070c10",
            // 深色模式下 MUI 會替高 elevation 的 Paper 疊白色 overlay，關掉維持墨色
            backgroundImage: "none",
            color: siteInk.text,
          },
        },
      }}
    >
      {headerNavigationItems.map((nav) =>
        isLayoutDropMenu(nav) ? (
          <Accordion
            key={nav.title}
            defaultExpanded={nav === match?.group}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: "transparent",
              color: "inherit",
              borderBottom: `1px solid ${siteInk.line}`,
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: siteInk.textMuted }} />}
              sx={{ px: 0, fontSize: 16, fontWeight: 700 }}
            >
              {nav.title}
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              {nav.items.map((item) => {
                const here = item === match?.item;
                return (
                  <SiteNavLink
                    key={item.title}
                    item={item}
                    onClick={onClose}
                    sx={{
                      display: "block",
                      py: 1,
                      pl: 1.5,
                      borderLeft: "2px solid",
                      borderColor: here ? siteInk.glow : "transparent",
                      color: here ? siteInk.glow : undefined,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      {item.title}
                      {item.external && <ExternalMark />}
                    </Box>
                    {item.description && (
                      <Typography
                        sx={{
                          mt: 0.25,
                          fontSize: 12,
                          color: siteInk.textMuted,
                        }}
                      >
                        {item.description}
                      </Typography>
                    )}
                  </SiteNavLink>
                );
              })}
            </AccordionDetails>
          </Accordion>
        ) : (
          <SiteNavLink
            key={nav.title}
            item={nav}
            onClick={onClose}
            sx={topLinkSx}
          >
            {nav.title}
            {nav.external && <ExternalMark />}
          </SiteNavLink>
        ),
      )}
    </Drawer>
  );
}
