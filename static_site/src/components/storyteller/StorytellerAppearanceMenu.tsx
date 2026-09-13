import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import {
  Box,
  Divider,
  IconButton,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { SteamPaletteSwitcher } from "@/components/storyteller/SteamPaletteSwitcher.tsx";
import { useStorytellerThemeMode } from "@/layouts/storytellerThemeMode.tsx";

/** Header 共用的外觀入口，將明暗模式與網站色系集中在同一個低干擾選單。 */
export function StorytellerAppearanceMenu() {
  const { mode, toggleMode } = useStorytellerThemeMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="外觀設定">
        <IconButton
          aria-label="外觀設定"
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
        <Stack spacing={1.5} sx={{ width: 290, p: 2 }}>
          <Typography fontWeight={700}>外觀設定</Typography>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.75 }}
            >
              明暗模式
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={mode}
              onChange={(_, nextMode) => {
                if (nextMode && nextMode !== mode) toggleMode();
              }}
              aria-label="明暗模式"
            >
              <ToggleButton value="light" aria-label="日間模式">
                <LightModeIcon fontSize="small" sx={{ mr: 0.75 }} />
                日間
              </ToggleButton>
              <ToggleButton value="dark" aria-label="夜間模式">
                <DarkModeIcon fontSize="small" sx={{ mr: 0.75 }} />
                夜間
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Divider />
          <Box>
            <Typography variant="caption" color="text.secondary">
              網站色系
            </Typography>
            <SteamPaletteSwitcher />
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
