import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs, type Crumb } from "@/components/AppBreadcrumbs.tsx";
import { backend, type DocumentItem, type Project } from "@/lib/backend.ts";
import { useBackendData } from "@/lib/useBackendData.ts";
import { ChatPanel } from "@/pages/workspace/ChatPanel.tsx";
import { EditorPanel } from "@/pages/workspace/EditorPanel.tsx";
import { HistoryPanel } from "@/pages/workspace/HistoryPanel.tsx";
import { WorkspaceSidebar } from "@/pages/workspace/WorkspaceSidebar.tsx";
import { findGroup, type DocumentTab } from "@/pages/workspace/workspaceTree.ts";

const tabs: { value: DocumentTab; icon: React.ReactElement }[] = [
  { value: "editor", icon: <EditIcon fontSize="small" /> },
  { value: "history", icon: <HistoryIcon fontSize="small" /> },
];

// 進專案先看 AI 助理。點側邊列的故事或設定才換成編輯／歷史；再點「AI 助理」回來。
export function WorkspacePage({ project, onBack }: { project: Project; onBack: () => void }) {
  const { t } = useTranslation();
  const workspace = useBackendData(() => backend.Workspace(project.public_id), [project.public_id]);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [tab, setTab] = useState<DocumentTab>("editor");

  const group = workspace && selected ? findGroup(workspace, selected) : null;
  const crumbs: Crumb[] = [
    { label: t("projects.title"), onClick: onBack },
    { label: project.name, onClick: selected ? () => setSelected(null) : undefined },
    ...(group ? [{ label: group.name }] : []),
    ...(selected ? [{ label: selected.title }] : []),
  ];

  return (
    <>
      <AppBreadcrumbs items={crumbs} />
      {workspace === null ? (
        <CircularProgress size={24} sx={{ m: 4 }} />
      ) : (
        workspace && (
          <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
            <WorkspaceSidebar workspace={workspace} selected={selected} onSelect={setSelected} onAssistant={() => setSelected(null)} />
            <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {selected ? (
                <>
                  <Tabs value={tab} onChange={(_, value: DocumentTab) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: "divider", minHeight: 46, flex: "none" }}>
                    {tabs.map(({ value, icon }) => (
                      <Tab key={value} value={value} icon={icon} iconPosition="start" label={t(`workspace.tabs.${value}`)} sx={{ minHeight: 46 }} />
                    ))}
                  </Tabs>
                  <Box key={`${selected.kind}:${selected.public_id}`} sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                    {tab === "editor" && <EditorPanel project={project.public_id} item={selected} />}
                    {tab === "history" && <HistoryPanel project={project.public_id} item={selected} />}
                  </Box>
                </>
              ) : (
                <ChatPanel projectID={project.public_id} projectName={project.name} />
              )}
            </Box>
          </Box>
        )
      )}
    </>
  );
}
