import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { DocumentItem, Workspace } from "@/lib/backend.ts";
import { GroupRow, SidebarSection } from "@/pages/workspace/SidebarRows.tsx";

type Props = { workspace: Workspace; selected: DocumentItem | null; onSelect: (item: DocumentItem) => void };

// 專案工作台側邊列：作品與冊、設定集、資產集、梭梭的記憶（後兩者目前只列出，還不能打開）。
export function WorkspaceSidebar({ workspace, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const ungroupedStories = workspace.ungrouped_stories ?? [];
  const uncategorizedLores = workspace.uncategorized_lores ?? [];
  return (
    <Box component="nav" sx={{ width: 248, flex: "none", borderRight: 1, borderColor: "divider", overflow: "auto", py: 0.5 }}>
      <SidebarSection icon={<AutoStoriesIcon />} title={t("workspace.sections.stories")}>
        {(workspace.volumes ?? []).map((volume) => (
          <GroupRow key={volume.public_id} name={volume.name} items={volume.items ?? []} selected={selected} onSelect={onSelect} />
        ))}
        {ungroupedStories.length > 0 && (
          <GroupRow name={t("workspace.ungroupedStories")} items={ungroupedStories} selected={selected} onSelect={onSelect} />
        )}
      </SidebarSection>
      <SidebarSection icon={<SettingsIcon />} title={t("workspace.sections.lores")}>
        {(workspace.lore_collections ?? []).map((collection) => (
          <GroupRow key={collection.public_id} name={collection.name} items={collection.items ?? []} selected={selected} onSelect={onSelect} />
        ))}
        {uncategorizedLores.length > 0 && (
          <GroupRow name={t("workspace.uncategorizedLores")} items={uncategorizedLores} selected={selected} onSelect={onSelect} />
        )}
      </SidebarSection>
      <SidebarSection icon={<CollectionsIcon />} title={t("workspace.sections.assets")}>
        {(workspace.asset_collections ?? []).map((collection) => (
          <GroupRow key={collection.public_id} name={collection.name} selected={selected} />
        ))}
      </SidebarSection>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 1, color: "text.secondary" }}>
        <LightbulbIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" fontWeight={500}>
          {t("workspace.sections.memories")}
        </Typography>
      </Box>
    </Box>
  );
}
