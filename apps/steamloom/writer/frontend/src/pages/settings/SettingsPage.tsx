import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";
import { WorkerSettingsPage } from "@writer/pages/settings/WorkerSettingsPage.tsx";

// SettingsSection 是設定側邊列的分類；新增設定只要在 sections 加一項（id、圖示、標題、內容）。
export type SettingsSection = "workers";

const sections: { id: SettingsSection; icon: ReactNode; title: string; render: () => ReactNode }[] = [
  { id: "workers", icon: <ImageOutlinedIcon fontSize="small" />, title: "settings.workers.title", render: () => <WorkerSettingsPage /> },
];

// 打開「設定…」時預設停在第一個分類；左側列出全部分類，作者一眼看得到還有哪些設定。
export const defaultSettingsSection: SettingsSection = sections[0].id;

// SettingsPage 是設定的外框：左側分類側邊列，右側顯示目前分類的設定內容。
export function SettingsPage({ rootLabel, section, onSection, onBack }: { rootLabel: string; section: SettingsSection; onSection: (section: SettingsSection) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const current = sections.find((item) => item.id === section) ?? sections[0];
  return (
    <>
      <AppBreadcrumbs items={[{ label: rootLabel, onClick: onBack }, { label: t("settings.title") }, { label: t(current.title) }]} />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Box component="nav" sx={{ width: 220, flex: "none", borderRight: 1, borderColor: "divider", overflow: "auto" }}>
          <List dense sx={{ py: 1 }}>
            {sections.map((item) => (
              <ListItemButton key={item.id} selected={item.id === current.id} onClick={() => onSection(item.id)} sx={{ mx: 1, borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={t(item.title)} />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>{current.render()}</Box>
      </Box>
    </>
  );
}
