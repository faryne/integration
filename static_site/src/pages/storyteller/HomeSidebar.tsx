import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableIcon from "@mui/icons-material/Cable";
import KeyIcon from "@mui/icons-material/Key";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { WorkspaceSidebarFooter } from "./ProjectWorkspacePreviewComponents.tsx";
import { tabBreadcrumbLabel, type StorytellerHomeTab } from "./homeTabs.ts";

const homeNavItems: { tab: StorytellerHomeTab; icon: ReactNode }[] = [
  { tab: "project", icon: <AutoStoriesIcon fontSize="small" /> },
  { tab: "agent", icon: <SmartToyIcon fontSize="small" /> },
  { tab: "apikey", icon: <KeyIcon fontSize="small" /> },
  { tab: "usage", icon: <QueryStatsIcon fontSize="small" /> },
  { tab: "mcp", icon: <CableIcon fontSize="small" /> },
];

export function HomeSidebar({
  activeTab,
  onSelect,
}: {
  activeTab: StorytellerHomeTab;
  onSelect: (tab: StorytellerHomeTab) => void;
}) {
  return (
    <Stack sx={{ height: 1, color: "text.secondary" }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1 }}>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {homeNavItems.map((item) => (
            <ListItemButton
              key={item.tab}
              selected={activeTab === item.tab}
              onClick={() => onSelect(item.tab)}
              sx={{
                borderRadius: 1,
                my: 0.125,
                minHeight: 34,
                px: 1,
                color: "text.secondary",
                "&:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8",
                },
                "&.Mui-selected": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.13),
                  color: "text.primary",
                  borderLeft: 3,
                  borderLeftColor: "primary.main",
                  pl: 0.625,
                },
                "&.Mui-selected:hover": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 30,
                  color: activeTab === item.tab ? "primary.main" : "inherit",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={tabBreadcrumbLabel[item.tab]}
                primaryTypographyProps={{
                  fontWeight: 700,
                  noWrap: true,
                  fontSize: 13,
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <WorkspaceSidebarFooter />
    </Stack>
  );
}

export function HomeMobileNav(props: Parameters<typeof HomeSidebar>[0]) {
  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxHeight: 280,
          overflow: "auto",
          borderRadius: 1,
          bgcolor: "transparent",
        }}
      >
        <HomeSidebar {...props} />
      </Paper>
    </Box>
  );
}
