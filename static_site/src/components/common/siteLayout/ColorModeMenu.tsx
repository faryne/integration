import { useState } from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useColorScheme,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";

import { headerIconButtonSx, headerMenuPaperSx } from "./headerStyles.ts";

const modes = [
  { key: "system", label: "跟隨系統", Icon: SettingsBrightnessIcon },
  { key: "light", label: "淺色", Icon: LightModeIcon },
  { key: "dark", label: "深色", Icon: DarkModeIcon },
] as const;

/** 色彩模式切換：跟隨系統／淺色／深色，偏好由 MUI 存進 localStorage */
export function ColorModeMenu() {
  const { mode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const current = modes.find((m) => m.key === mode) ?? modes[0];

  return (
    <>
      <Tooltip title={`色彩模式：${current.label}`}>
        <IconButton
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={headerIconButtonSx}
        >
          <current.Icon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: headerMenuPaperSx } }}
      >
        {modes.map(({ key, label, Icon }) => (
          <MenuItem
            key={key}
            role="menuitemradio"
            aria-checked={key === current.key}
            selected={key === current.key}
            onClick={() => {
              setMode(key);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
            {key === current.key && <CheckIcon fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
