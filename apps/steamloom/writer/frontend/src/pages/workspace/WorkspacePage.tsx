import ChatIcon from "@mui/icons-material/Chat";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs, type Crumb } from "@/components/AppBreadcrumbs.tsx";
import { backend, type DocumentItem, type Project } from "@/lib/backend.ts";
import { useBackendData } from "@/lib/useBackendData.ts";
import { ChatPanel } from "@/pages/workspace/ChatPanel.tsx";
import { EditorPanel } from "@/pages/workspace/EditorPanel.tsx";
import { HistoryPanel } from "@/pages/workspace/HistoryPanel.tsx";
import { WorkspaceSidebar } from "@/pages/workspace/WorkspaceSidebar.tsx";
import { findGroup, firstDocument, type WorkspaceTab } from "@/pages/workspace/workspaceTree.ts";

const tabs: { value: WorkspaceTab; icon: React.ReactElement }[] = [
  { value: "chat", icon: <ChatIcon fontSize="small" /> },
  { value: "editor", icon: <EditIcon fontSize="small" /> },
  { value: "history", icon: <HistoryIcon fontSize="small" /> },
];

// 專案主頁：左側邊列選文件，右邊三個分頁（AI 對話／編輯／編輯歷史）都針對選到的那一篇。
export function WorkspacePage({ project, onBack }: { project: Project; onBack: () => void }) {
  const { t } = useTranslation();
  const workspace = useBackendData(() => backend.Workspace(project.public_id), [project.public_id]);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("chat");

  // 載入完預設打開第一篇，畫面不會一進來是空的
  useEffect(() => {
    if (workspace) setSelected((current) => current ?? firstDocument(workspace));
  }, [workspace]);

  const group = workspace && selected ? findGroup(workspace, selected) : null;
  const crumbs: Crumb[] = [
    { label: t("projects.title"), onClick: onBack },
    { label: project.name },
    ...(group ? [{ label: group.name }] : []),
    ...(selected ? [{ label: selected.title }] : []),
  ];

  return (
    <>
      <AppBreadcrumbs items={crumbs} />
      {workspace === null ? (
        <CircularProgress size={24} sx={{ m: 4 }} />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          {workspace && <WorkspaceSidebar workspace={workspace} selected={selected} onSelect={setSelected} />}
          {selected && (
            <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <Tabs value={tab} onChange={(_, value: WorkspaceTab) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: "divider", minHeight: 46, flex: "none" }}>
                {tabs.map(({ value, icon }) => (
                  <Tab key={value} value={value} icon={icon} iconPosition="start" label={t(`workspace.tabs.${value}`)} sx={{ minHeight: 46 }} />
                ))}
              </Tabs>
              {/* key 綁文件：切換文件時各分頁的狀態（草稿、捲動位置）重新開始 */}
              <Box key={`${selected.kind}:${selected.public_id}`} sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                {tab === "chat" && <ChatPanel />}
                {tab === "editor" && <EditorPanel project={project.public_id} item={selected} />}
                {tab === "history" && <HistoryPanel project={project.public_id} item={selected} />}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </>
  );
}
