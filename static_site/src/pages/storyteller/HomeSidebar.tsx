import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableIcon from "@mui/icons-material/Cable";
import FavoriteIcon from "@mui/icons-material/Favorite";
import KeyIcon from "@mui/icons-material/Key";
import PersonIcon from "@mui/icons-material/Person";
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
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { WorkspaceSidebarFooter } from "./ProjectWorkspacePreviewComponents.tsx";
import {
  homeTabGroups,
  tabBreadcrumbLabel,
  type StorytellerHomeTab,
} from "./homeTabs.ts";

const tabIcons: Record<StorytellerHomeTab, ReactNode> = {
  project: <AutoStoriesIcon fontSize="small" />,
  agent: <SmartToyIcon fontSize="small" />,
  apikey: <KeyIcon fontSize="small" />,
  usage: <QueryStatsIcon fontSize="small" />,
  mcp: <CableIcon fontSize="small" />,
  favorites: <FavoriteIcon fontSize="small" />,
  profile: <PersonIcon fontSize="small" />,
};

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
          {homeTabGroups.map((group, groupIndex) => (
            <Box key={group.label} sx={{ mt: groupIndex === 0 ? 0 : 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1,
                  pb: 0.5,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  color: "text.disabled",
                }}
              >
                {group.label}
              </Typography>
              {group.tabs.map((tab) => (
                <ListItemButton
                  key={tab}
                  selected={activeTab === tab}
                  onClick={() => onSelect(tab)}
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
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.13),
                      color: "text.primary",
                      borderLeft: 3,
                      borderLeftColor: "primary.main",
                      pl: 0.625,
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.16),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 30,
                      color: activeTab === tab ? "primary.main" : "inherit",
                    }}
                  >
                    {tabIcons[tab]}
                  </ListItemIcon>
                  <ListItemText
                    primary={tabBreadcrumbLabel[tab]}
                    primaryTypographyProps={{
                      fontWeight: 700,
                      noWrap: true,
                      fontSize: 13,
                    }}
                  />
                </ListItemButton>
              ))}
            </Box>
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
