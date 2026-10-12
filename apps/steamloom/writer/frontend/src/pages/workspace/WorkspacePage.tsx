import { StorytellerEditorDataContext } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs, type Crumb } from "@writer/components/AppBreadcrumbs.tsx";
import { backend, errorMessage, type DocumentItem, type Profile, type Project, type Workspace } from "@writer/lib/backend.ts";
import { invalidateEditorLores, writerEditorData } from "@writer/lib/editorData.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { ChatPanel } from "@writer/pages/workspace/ChatPanel.tsx";
import { EditorPanel } from "@writer/pages/workspace/EditorPanel.tsx";
import { HistoryPanel } from "@writer/pages/workspace/HistoryPanel.tsx";
import { AssetListPanel, DocumentListPanel, type ListSection } from "@writer/pages/workspace/ListPanels.tsx";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { useWorkspaceEditing } from "@writer/pages/workspace/useWorkspaceEditing.ts";
import { WorkspaceSidebar } from "@writer/pages/workspace/WorkspaceSidebar.tsx";
import { UnsavedChangesDialog } from "@writer/pages/workspace/UnsavedChangesDialog.tsx";
import { findGroup, groupTargets, isSameDocument, type DocumentTab } from "@writer/pages/workspace/workspaceTree.ts";

// 還沒載入前給 hook 用的空工作台（hook 必須無條件呼叫）
const emptyWorkspace: Workspace = { volumes: [], ungrouped_stories: [], lore_collections: [], uncategorized_lores: [], asset_collections: [] };

const tabs: { value: DocumentTab; icon: React.ReactElement }[] = [
  { value: "editor", icon: <EditIcon fontSize="small" /> },
  { value: "history", icon: <HistoryIcon fontSize="small" /> },
];

// 進專案先看 AI 助理。點側邊列的故事或設定換成編輯／歷史，點「全部作品／全部設定／全部資產」看列表；再點「AI 助理」回來。
// 編輯中的文件有未存檔內容時，換文件、看列表、回 AI 助理、離開專案都要先確認。
export function WorkspacePage({ project, profile, onBack }: { project: Project; profile: Profile | null; onBack: () => void }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const loaded = useBackendData(() => backend.Workspace(project.public_id), [project.public_id]);
  // 建立／移動／排序後重新抓的結果；有值就蓋過初次載入，重抓期間不讓整個側邊列變回轉圈
  const [refreshed, setRefreshed] = useState<Workspace | null>(null);
  const workspace = refreshed ?? loaded;
  // 每次重新抓工作台就 +1，讓「全部…」列表跟著重抓
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setVersion((value) => value + 1);
    // 設定可能新增、改名或搬移，編輯器的「連到設定」清單跟著重抓
    invalidateEditorLores(project.public_id);
    void backend
      .Workspace(project.public_id)
      .then(setRefreshed)
      .catch((err) => showError(errorMessage(err)));
  }, [project.public_id, showError]);
  const [selected, setSelectedState] = useState<DocumentItem | null>(null);
  const [listSection, setListSection] = useState<ListSection | null>(null);
  const [tab, setTab] = useState<DocumentTab>("editor");
  const [dirty, setDirty] = useState(false);
  // 等待確認「放棄未存檔內容」的動作
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());
  // 主畫面一次只顯示一種：文件、列表，或都沒有時的 AI 助理
  const setSelected = (item: DocumentItem | null) => {
    // 再點一次正在編輯的同一篇不算離開
    if (item && selected && isSameDocument(item, selected)) return setListSection(null);
    guard(() => {
      setSelectedState(item);
      setListSection(null);
    });
  };
  const openList = (section: ListSection) =>
    guard(() => {
      setSelectedState(null);
      setListSection(section);
    });
  const editing = useWorkspaceEditing({
    project: project.public_id,
    workspace: workspace ?? emptyWorkspace,
    setWorkspace: setRefreshed,
    reload,
  });

  const group = workspace && selected ? findGroup(workspace, selected) : null;
  const crumbs: Crumb[] = [
    { label: t("projects.title"), onClick: () => guard(onBack) },
    { label: project.name, onClick: selected || listSection ? () => setSelected(null) : undefined },
    ...(listSection ? [{ label: t(`workspace.all.${listSection}`) }] : []),
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
              listSection={listSection}
              onList={openList}
              editing={editing}
              onCreated={(item) =>
                guard(() => {
                  setSelectedState(item);
                  setListSection(null);
                  setTab("editor");
                })
              }
            />
            <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <StorytellerEditorDataContext.Provider value={writerEditorData}>
              {selected ? (
                <>
                  <Tabs value={tab} onChange={(_, value: DocumentTab) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: "divider", minHeight: 46, flex: "none" }}>
                    {tabs.map(({ value, icon }) => (
                      <Tab key={value} value={value} icon={icon} iconPosition="start" label={t(`workspace.tabs.${value}`)} sx={{ minHeight: 46 }} />
                    ))}
                  </Tabs>
                  <Box key={`${selected.kind}:${selected.public_id}`} sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                    {/* 切到編輯歷史時編輯器不卸載，未存檔的內容與游標位置都留著 */}
                    <Box sx={{ flex: 1, minWidth: 0, display: tab === "editor" ? "flex" : "none" }}>
                      <EditorPanel
                        project={project.public_id}
                        item={selected}
                        groupId={group?.public_id ?? ""}
                        groupTargets={groupTargets(workspace, selected.kind, t(selected.kind === "story" ? "workspace.ungroupedStories" : "workspace.uncategorizedLores"))}
                        profile={profile}
                        onDirtyChange={setDirty}
                        onSaved={reload}
                        onShowHistory={() => setTab("history")}
                      />
                    </Box>
                    {tab === "history" && <HistoryPanel project={project.public_id} item={selected} />}
                  </Box>
                </>
              ) : listSection === "assets" ? (
                <AssetListPanel project={project.public_id} version={version} />
              ) : listSection ? (
                <DocumentListPanel project={project.public_id} kind={listSection === "stories" ? "story" : "lore"} version={version} onOpen={setSelected} />
              ) : (
                <ChatPanel projectID={project.public_id} projectName={project.name} />
              )}
              </StorytellerEditorDataContext.Provider>
            </Box>
          </Box>
        )
      )}
      <UnsavedChangesDialog
        open={pending !== null}
        onCancel={() => setPending(null)}
        onDiscard={() => {
          pending?.();
          setPending(null);
        }}
      />
    </>
  );
}
