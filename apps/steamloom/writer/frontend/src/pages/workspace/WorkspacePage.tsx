import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs, type Crumb } from "@/components/AppBreadcrumbs.tsx";
import { backend, errorMessage, type DocumentItem, type Project, type Workspace } from "@/lib/backend.ts";
import { useBackendData } from "@/lib/useBackendData.ts";
import { ChatPanel } from "@/pages/workspace/ChatPanel.tsx";
import { EditorPanel } from "@/pages/workspace/EditorPanel.tsx";
import { HistoryPanel } from "@/pages/workspace/HistoryPanel.tsx";
import { useSnack } from "@/components/SnackProvider.tsx";
import { useWorkspaceEditing } from "@/pages/workspace/useWorkspaceEditing.ts";
import { WorkspaceSidebar } from "@/pages/workspace/WorkspaceSidebar.tsx";
import { findGroup, type DocumentTab } from "@/pages/workspace/workspaceTree.ts";

// 還沒載入前給 hook 用的空工作台（hook 必須無條件呼叫）
const emptyWorkspace: Workspace = { volumes: [], ungrouped_stories: [], lore_collections: [], uncategorized_lores: [], asset_collections: [] };

const tabs: { value: DocumentTab; icon: React.ReactElement }[] = [
  { value: "editor", icon: <EditIcon fontSize="small" /> },
  { value: "history", icon: <HistoryIcon fontSize="small" /> },
];

// 進專案先看 AI 助理。點側邊列的故事或設定才換成編輯／歷史；再點「AI 助理」回來。
export function WorkspacePage({ project, onBack }: { project: Project; onBack: () => void }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const loaded = useBackendData(() => backend.Workspace(project.public_id), [project.public_id]);
  // 建立／移動／排序後重新抓的結果；有值就蓋過初次載入，重抓期間不讓整個側邊列變回轉圈
  const [refreshed, setRefreshed] = useState<Workspace | null>(null);
  const workspace = refreshed ?? loaded;
  const reload = useCallback(
    () =>
      void backend
        .Workspace(project.public_id)
        .then(setRefreshed)
        .catch((err) => showError(errorMessage(err))),
    [project.public_id, showError],
  );
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [tab, setTab] = useState<DocumentTab>("editor");
  const editing = useWorkspaceEditing({
    project: project.public_id,
    workspace: workspace ?? emptyWorkspace,
    setWorkspace: setRefreshed,
    reload,
  });

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
            <WorkspaceSidebar
              workspace={workspace}
              selected={selected}
              onSelect={setSelected}
              onAssistant={() => setSelected(null)}
              editing={editing}
              onCreated={(item) => {
                setSelected(item);
                setTab("editor");
              }}
            />
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
