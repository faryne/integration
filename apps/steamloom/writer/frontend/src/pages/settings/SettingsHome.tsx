import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";

// SettingsSection 是設定首頁可進入的分類；之後新增設定只要在這裡和 sections 各加一項，再到 App.tsx 接上頁面。
export type SettingsSection = "workers";

const sections: { id: SettingsSection; icon: ReactNode; title: string }[] = [
  { id: "workers", icon: <ImageOutlinedIcon fontSize="small" />, title: "settings.workers.title" },
];

// SettingsHome 是「設定…」的入口頁：列出各設定分類，點進去才是該分類的設定頁。
export function SettingsHome({ rootLabel, onBack, onOpen }: { rootLabel: string; onBack: () => void; onOpen: (section: SettingsSection) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <AppBreadcrumbs items={[{ label: rootLabel, onClick: onBack }, { label: t("settings.title") }]} />
      <Box sx={{ flex: 1, overflow: "auto", p: 3, maxWidth: 720 }}>
        <Typography variant="h5" sx={{ fontSize: 19, mb: 2 }}>{t("settings.title")}</Typography>
        <Paper variant="outlined">
          <List disablePadding>
            {sections.map((section) => (
              <ListItemButton key={section.id} onClick={() => onOpen(section.id)}>
                <ListItemIcon sx={{ minWidth: 36 }}>{section.icon}</ListItemIcon>
                <ListItemText primary={t(section.title)} />
                <ChevronRightIcon fontSize="small" color="action" />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Box>
    </>
  );
}
