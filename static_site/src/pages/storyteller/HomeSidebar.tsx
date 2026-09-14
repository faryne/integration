import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableIcon from "@mui/icons-material/Cable";
import FavoriteIcon from "@mui/icons-material/Favorite";
import KeyIcon from "@mui/icons-material/Key";
import MenuIcon from "@mui/icons-material/Menu";
import PersonIcon from "@mui/icons-material/Person";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useState } from "react";
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
                    "&:hover": { bgcolor: "action.hover" },
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
    </Stack>
  );
}

export function HomeMobileNav({
  activeTab,
  onSelect,
}: Parameters<typeof HomeSidebar>[0]) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Button
          fullWidth
          color="inherit"
          startIcon={<MenuIcon />}
          onClick={() => setOpen(true)}
          sx={{ justifyContent: "flex-start" }}
        >
          工作台導覽 · {tabBreadcrumbLabel[activeTab]}
        </Button>
      </Box>
      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 300, maxWidth: "88vw" } } }}
      >
        <Stack sx={{ height: 1 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}
          >
            <Typography variant="h6">工作台導覽</Typography>
            <IconButton
              aria-label="關閉工作台導覽"
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <HomeSidebar
            activeTab={activeTab}
            onSelect={(tab) => {
              onSelect(tab);
              setOpen(false);
            }}
          />
        </Stack>
      </Drawer>
    </>
  );
}
