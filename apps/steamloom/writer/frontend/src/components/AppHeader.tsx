import { SteamLoomMark } from "@steamloom-web/components/storyteller/SteamLoomMark.tsx";
import LogoutIcon from "@mui/icons-material/Logout";
import { Avatar, Box, ButtonBase, ListItemIcon, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@writer/lib/backend.ts";

// 頂部列：左邊品牌標誌，右邊登入後的作者帳號。應用程式設定的入口在作業系統選單列（menu.go），不放在這裡。
export function AppHeader({ profile, onLogout }: { profile: Profile | null; onLogout: () => void }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ height: 52, px: 2.25, flex: "none", borderBottom: 1, borderColor: "divider" }}
    >
      <SteamLoomMark size={22} />
      <Typography variant="h6" sx={{ ml: 1, fontSize: 16 }}>
        {t("app.name")}
      </Typography>
      <Typography
        component="span"
        sx={{ ml: 0.75, px: 0.65, py: 0.15, border: 1, borderColor: "divider", borderRadius: 10, color: "text.secondary", fontSize: 10, lineHeight: 1.2, letterSpacing: 0.4 }}
      >
        Writer
      </Typography>
      <Box sx={{ flex: 1 }} />
      {profile && (
        <>
          <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} sx={{ gap: 1, borderRadius: 1, px: 1, py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {profile.pen_name}
            </Typography>
            <Avatar src={profile.avatar_url || undefined} sx={{ width: 28, height: 28 }} />
          </ButtonBase>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                onLogout();
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              {t("app.account.logout")}
            </MenuItem>
          </Menu>
        </>
      )}
    </Stack>
  );
}
