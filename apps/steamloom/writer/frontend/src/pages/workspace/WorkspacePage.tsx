import { StorytellerEditorDataContext } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { StorytellerMemoryManagerPage } from "@/pages/storyteller/StorytellerMemoryManagerPage.tsx";
import { WorkspaceSidebarToggle } from "@/pages/storyteller/WorkspaceSidebarChrome.tsx";
import { Box, CircularProgress } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs, type Crumb } from "@writer/components/AppBreadcrumbs.tsx";
import { backend, errorMessage, UNCATEGORIZED_ASSETS, type Asset, type DocumentItem, type Profile, type Project, type Workspace } from "@writer/lib/backend.ts";
import { invalidateEditorAssets, invalidateEditorLores, writerEditorData } from "@writer/lib/editorData.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { ChatPanel } from "@writer/pages/workspace/ChatPanel.tsx";
import { EditorPanel } from "@writer/pages/workspace/EditorPanel.tsx";
import { AssetDetail, AssetListPanel } from "@writer/pages/workspace/AssetPanels.tsx";
import { DocumentListPanel, type ListSection } from "@writer/pages/workspace/ListPanels.tsx";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { useWorkspaceEditing } from "@writer/pages/workspace/useWorkspaceEditing.ts";
import type { RowActionTarget } from "@writer/pages/workspace/useDocumentRowActions.tsx";
import { WorkspaceSidebar, WorkspaceSidebarRail } from "@writer/pages/workspace/WorkspaceSidebar.tsx";
import { UnsavedChangesDialog } from "@writer/pages/workspace/UnsavedChangesDialog.tsx";
import { findGroup, groupTargets, isSameDocument, workspaceDocuments } from "@writer/pages/workspace/workspaceTree.ts";
import type { PromptReference } from "@writer/pages/workspace/promptReferences.ts";

// 還沒載入前給 hook 用的空工作台（hook 必須無條件呼叫）
const emptyWorkspace: Workspace = { volumes: [], ungrouped_stories: [], lore_collections: [], uncategorized_lores: [], asset_collections: [] };

// 進專案先看 AI 助理。點側邊列的故事或設定換成編輯／歷史，點「全部作品／全部設定／全部資產」或資產集看列表，
// 資產列表點卡片看資產詳細；點「梭梭的記憶」看記憶管理；再點「AI 助理」回來。
// 編輯中的文件有未存檔內容時，換文件、看列表、回 AI 助理、離開專案都要先確認。
// initialCreate：剛建立的專案選了「建立第一篇故事」，進來就打開側邊列的新增故事對話框
export function WorkspacePage({ project, profile, initialCreate, onBack }: { project: Project; profile: Profile | null; initialCreate?: "story"; onBack: () => void }) {
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
    // 設定、資產可能新增、改名、搬移或刪除，編輯器的「連到設定」清單與資產選擇對話框跟著重抓
    invalidateEditorLores(project.public_id);
    invalidateEditorAssets(project.public_id);
    void backend
      .Workspace(project.public_id)
      .then(setRefreshed)
      .catch((err) => showError(errorMessage(err)));
  }, [project.public_id, showError]);
  const [selected, setSelectedState] = useState<DocumentItem | null>(null);
  const [listSection, setListSection] = useState<ListSection | null>(null);
  // 資產列表的篩選（空字串＝全部、UNCATEGORIZED_ASSETS＝未分類、其他＝資產集）與打開的資產詳細
  const [assetCollection, setAssetCollection] = useState("");
  const [openedAsset, setOpenedAsset] = useState<Asset | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [assistantReference, setAssistantReference] = useState<PromptReference | null>(null);
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
      setOpenedAsset(null);
    });
  };
  const openList = (section: ListSection, collection = "") =>
    guard(() => {
      setSelectedState(null);
      setListSection(section);
      setAssetCollection(collection);
      setOpenedAsset(null);
    });
  const editing = useWorkspaceEditing({
    project: project.public_id,
    workspace: workspace ?? emptyWorkspace,
    setWorkspace: setRefreshed,
    reload,
  });

  // 編輯器選取內容後切到 AI 助理；若目前有未存檔變更，沿用既有離開確認。
  const askAI = (reference: PromptReference) => guard(() => {
    setAssistantReference(reference);
    setSelectedState(null);
    setListSection(null);
    setOpenedAsset(null);
  });

  // 側邊列／列表的 ⋮ 刪掉正在編輯的那篇：直接到該類的「全部…」列表（比照網站回列表；東西已經不在，不用問未存檔）
  const onDocumentDeleted = (target: RowActionTarget) => {
    if (!selected || !isSameDocument(target, selected)) return;
    setSelectedState(null);
    setListSection(target.kind === "story" ? "stories" : "lores");
  };

  const group = workspace && selected ? findGroup(workspace, selected) : null;
  // 工作台樹上的這篇（帶公開狀態，⋮ 改了狀態後重抓會更新）
  const selectedNode = workspace && selected ? workspaceDocuments(workspace, selected.kind).find((each) => isSameDocument(each, selected)) : undefined;
  // 設定的「需先讀過」可選：同專案的故事與其他設定
  const dependencyOptions =
    workspace && selected?.kind === "lore"
      ? [
          ...workspaceDocuments(workspace, "story").map((each) => ({ kind: "story" as const, publicId: each.public_id, title: each.title, image: each.content_type === "image" })),
          ...workspaceDocuments(workspace, "lore")
            .filter((each) => each.public_id !== selected.public_id)
            .map((each) => ({ kind: "lore" as const, publicId: each.public_id, title: each.title })),
        ]
      : [];
  const assetCollections = workspace?.asset_collections ?? [];
  const assetCollectionName =
    assetCollection === UNCATEGORIZED_ASSETS ? t("workspace.upload.uncategorized") : assetCollections.find((each) => each.public_id === assetCollection)?.name;
  // 資產：全部資產 › 資產集 › 資產，前面幾層可以點回去
  const assetCrumbs: Crumb[] = [
    { label: t("workspace.all.assets"), onClick: assetCollection || openedAsset ? () => openList("assets") : undefined },
    ...(assetCollectionName ? [{ label: assetCollectionName, onClick: openedAsset ? () => openList("assets", assetCollection) : undefined }] : []),
    ...(openedAsset ? [{ label: openedAsset.title || openedAsset.original_filename }] : []),
  ];
  const crumbs: Crumb[] = [
    { label: t("projects.title"), onClick: () => guard(onBack) },
    { label: project.name, onClick: selected || listSection ? () => setSelected(null) : undefined },
    ...(listSection === "assets" ? assetCrumbs : listSection ? [{ label: t(`workspace.all.${listSection}`) }] : []),
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
            {/* 收合按鈕浮貼在側邊列與內容的交界，外層不能 overflow: hidden（捲軸在側邊列自己那層） */}
            <Box sx={{ position: "relative", flex: "none", display: "flex" }}>
              {sidebarCollapsed ? (
                <WorkspaceSidebarRail selected={selected} listSection={listSection} onAssistant={() => setSelected(null)} onList={openList} />
              ) : (
                <WorkspaceSidebar
                  project={project.public_id}
                  initialCreate={initialCreate}
                  workspace={workspace}
                  selected={selected}
                  onSelect={setSelected}
                  onAssistant={() => setSelected(null)}
                  listSection={listSection}
                  assetCollection={assetCollection}
                  onList={openList}
                  editing={editing}
                  onCreated={(item) =>
                    guard(() => {
                      setSelectedState(item);
                      setListSection(null);
                    })
                  }
                  onChanged={reload}
                  onDeleted={onDocumentDeleted}
                />
              )}
              <WorkspaceSidebarToggle
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((value) => !value)}
                collapseLabel={t("workspace.actions.collapseSidebar")}
                expandLabel={t("workspace.actions.expandSidebar")}
              />
            </Box>
            <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <StorytellerEditorDataContext.Provider value={writerEditorData}>
              {selected ? (
                // 「編輯／編輯歷史」分頁在共用編輯頁裡（圖像作品跟網站一樣沒有編輯歷史）
                <Box key={`${selected.kind}:${selected.public_id}`} sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                  <EditorPanel
                    project={project.public_id}
                    item={selected}
                    groupId={group?.public_id ?? ""}
                    status={selectedNode?.status}
                    groupTargets={groupTargets(workspace, selected.kind, t(selected.kind === "story" ? "workspace.ungroupedStories" : "workspace.uncategorizedLores"))}
                    profile={profile}
                    dependencyOptions={dependencyOptions}
                    onDirtyChange={setDirty}
                    onSaved={reload}
                    onAskAI={askAI}
                  />
                </Box>
              ) : listSection === "assets" && openedAsset ? (
                <AssetDetail
                  key={openedAsset.public_id}
                  project={project.public_id}
                  asset={openedAsset}
                  collections={assetCollections}
                  onChanged={reload}
                  onDeleted={() => openList("assets", assetCollection)}
                />
              ) : listSection === "assets" ? (
                <AssetListPanel
                  project={project.public_id}
                  collection={assetCollection}
                  collections={assetCollections}
                  version={version}
                  onOpen={setOpenedAsset}
                  onSelectCollection={(collection) => openList("assets", collection)}
                  onUpload={(collection) => void editing.upload(collection)}
                  onChanged={reload}
                />
              ) : listSection === "memories" ? (
                // 直接用網站那一頁，資料走 webApi.tsx 的 axios adapter（Go 轉發）
                <Box sx={{ flex: 1, overflow: "auto" }}>
                  <StorytellerMemoryManagerPage projectPublicId={project.public_id} />
                </Box>
              ) : listSection ? (
                <DocumentListPanel
                  project={project.public_id}
                  kind={listSection === "stories" ? "story" : "lore"}
                  groups={(listSection === "stories" ? workspace.volumes : workspace.lore_collections) ?? []}
                  version={version}
                  onOpen={setSelected}
                  onChanged={reload}
                />
              ) : (
                <ChatPanel
                  projectID={project.public_id}
                  projectName={project.name}
                  workspace={workspace}
                  initialReference={assistantReference}
                  onInitialReferenceConsumed={() => setAssistantReference(null)}
                  onWorkspaceChange={reload}
                />
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
