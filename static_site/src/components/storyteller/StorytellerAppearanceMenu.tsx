import DarkModeIcon from "@mui/icons-material/DarkMode";
import FlareIcon from "@mui/icons-material/Flare";
import LightModeIcon from "@mui/icons-material/LightMode";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import {
  Box,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import {
  storytellerAppearanceMeta,
  storytellerAppearanceOrder,
  type StorytellerAppearance,
} from "@/data/storytellerTheme.ts";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";

const appearanceIcons: Record<StorytellerAppearance, ReactNode> = {
  nocturne: <DarkModeIcon fontSize="small" />,
  ivory: <LightModeIcon fontSize="small" />,
  prism: <FlareIcon fontSize="small" />,
};

/** Header 唯一的全站外觀入口；三種 appearance 已各自包含明暗與配色。 */
export function StorytellerAppearanceMenu() {
  const { appearance, setAppearance } = useStorytellerAppearance();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={`外觀：${storytellerAppearanceMeta[appearance].label}`}>
        <IconButton
          aria-label={`外觀設定，目前為${storytellerAppearanceMeta[appearance].label}`}
          aria-expanded={Boolean(anchor)}
          color="inherit"
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <PaletteOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.25} sx={{ width: 300, p: 2 }}>
          <Box>
            <Typography fontWeight={700}>外觀</Typography>
            <Typography variant="caption" color="text.secondary">
              三種模式已包含完整的明暗與配色
            </Typography>
          </Box>
          {storytellerAppearanceOrder.map((name) => {
            const meta = storytellerAppearanceMeta[name];
            const isActive = appearance === name;
            return (
              <Stack
                key={name}
                component="button"
                type="button"
                direction="row"
                spacing={1.25}
                alignItems="center"
                aria-pressed={isActive}
                onClick={() => {
                  setAppearance(name);
                  setAnchor(null);
                }}
                sx={{
                  width: 1,
                  p: 1.25,
                  border: "1px solid",
                  borderColor: isActive ? "primary.main" : "divider",
                  color: "text.primary",
                  bgcolor: isActive ? "action.selected" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: isActive ? "primary.main" : "text.secondary",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: meta.swatch,
                  }}
                >
                  {appearanceIcons[name]}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {meta.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    {meta.description}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Popover>
    </>
  );
}
