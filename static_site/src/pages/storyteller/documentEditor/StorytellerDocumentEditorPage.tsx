import type { AlertColor } from "@mui/material";
import { Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useStorytellerAgents,
  useStorytellerLoreCollections,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerStories,
  useStorytellerUserProfile,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  STORYTELLER_AI_ASSISTANT_ENABLED,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { ACCOUNT_PROFILE_ID } from "@/helpers/storytellerAuthors.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { useDocumentEditingLeaveGuard } from "@/pages/storyteller/WorkspaceLeaveGuard.ts";
import { useWorkspaceEditorBack } from "@/pages/storyteller/WorkspaceEditorBackContext.ts";
import type {
  StorytellerAgent,
  StorytellerLore,
  StorytellerStory,
  StorytellerUserProfile,
} from "@/types/storyteller.ts";
import { initialAutoSaveMinutes } from "@/pages/storyteller/documentEditor/autoSaveMinutes.ts";
import type {
  DocumentDependencyOption,
  DocumentGroupOption,
} from "@/pages/storyteller/documentEditor/DocumentEditorHeader.tsx";
import {
  SteamLoomDocumentEditor,
  type DocumentEditorTab,
} from "@/pages/storyteller/documentEditor/SteamLoomDocumentEditor.tsx";
import { defaultDocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import { useDocumentEditorAgentWorkspace } from "@/pages/storyteller/documentEditor/useDocumentEditorAgentWorkspace.tsx";
import {
  defaultDocumentEditingMessages,
  useDocumentEditing,
  type DocumentKind,
  type EditingDocument,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";
import { useWebDocumentAdapter } from "@/pages/storyteller/documentEditor/webDocumentAdapter.ts";

function errorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    return data.message || fallback;
  }
  return fallback;
}

// 網站的故事／設定編輯頁（StoryEditor.tsx／LoreEditor.tsx 只是轉到這裡）。外層載入資料、處理登入與 404，
// 資料備齊後才掛上 DocumentEditorBody（以文件為 key），useDocumentEditing 一開始拿到的就是真正的文件；
// 編輯本體是跟 SteamLoom Writer 共用的 SteamLoomDocumentEditor。
// embedded＝工作台右欄；否則是舊版獨立頁（my/project/...），故事的 .../diff 網址對應「編輯歷史」分頁。
export function StorytellerDocumentEditorPage({
  kind,
  embedded = false,
  projectId,
  documentPublicId,
}: {
  kind: DocumentKind;
  embedded?: boolean;
  projectId?: string;
  documentPublicId?: string;
}) {
  const { t } = useTranslation();
  const params = useParams();
  const id = projectId ?? params.id;
  const documentId =
    documentPublicId ?? (kind === "story" ? params.storyId : params.loreId);
  const isNew = documentId === "new";
  const [searchParams] = useSearchParams();
  // 從工作台指定冊／設定集建立新文件時，網址帶 ?from=<publicId>，預設放進那一冊／設定集
  const defaultGroupIdFromQuery = searchParams.get("from") ?? "";
  const { session, loading: authLoading, login, submitting } = useAuth();

  const {
    data: apiProjects = [],
    isPending: projectsPending,
    isFetching: projectsFetching,
  } = useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const projectPublicId = apiProject?.public_id;
  const storiesQuery = useStorytellerStories(projectPublicId);
  const loresQuery = useStorytellerLores(projectPublicId);
  const apiStories = useMemo(
    () => storiesQuery.data ?? [],
    [storiesQuery.data],
  );
  const apiLores = useMemo(() => loresQuery.data ?? [], [loresQuery.data]);
  const { data: apiVolumes = [] } = useStorytellerVolumes(
    kind === "story" ? projectPublicId : undefined,
  );
  const { data: loreCollections = [] } = useStorytellerLoreCollections(
    kind === "lore" ? projectPublicId : undefined,
  );
  const { data: userProfile } = useStorytellerUserProfile();
  const { data: apiAgents = [] } = useStorytellerAgents();
  const apiStory =
    kind === "story"
      ? apiStories.find((item) => item.public_id === documentId)
      : undefined;
  const apiLore =
    kind === "lore"
      ? apiLores.find((item) => item.public_id === documentId)
      : undefined;
  const loadedDocument = apiStory ?? apiLore;
  const listQuery = kind === "story" ? storiesQuery : loresQuery;
  const groups = useMemo<DocumentGroupOption[]>(
    () =>
      kind === "story"
        ? apiVolumes.map((volume) => ({
            publicId: volume.public_id,
            name: volume.title,
          }))
        : loreCollections.map((collection) => ({
            publicId: collection.public_id,
            name: collection.name,
          })),
    [apiVolumes, kind, loreCollections],
  );

  // 交給 useDocumentEditing 的文件：伺服器上的最新內容；新文件是空白草稿（預設放進 ?from 指定的冊／設定集）
  const doc = useMemo<EditingDocument>(() => {
    if (apiStory) {
      // 故事的 parent_id 是內部 id，對到冊的 public_id
      const volume = apiVolumes.find((each) => each.id === apiStory.parent_id);
      return {
        publicId: apiStory.public_id,
        title: apiStory.title,
        summary: apiStory.summary,
        content: apiStory.latest_content,
        status: apiStory.status,
        groupId: volume?.public_id ?? "",
        profileIds: apiStory.profile_ids ?? [ACCOUNT_PROFILE_ID],
        isSpoiler: false,
        dependsOn: [],
        versionId: apiStory.latest_version_id,
        updatedAt: apiStory.updated_at,
        sort: apiStory.sort,
      };
    }
    if (apiLore) {
      return {
        publicId: apiLore.public_id,
        title: apiLore.title,
        summary: apiLore.summary ?? "",
        content: apiLore.latest_content,
        status: apiLore.status ?? "draft",
        groupId: apiLore.collection_id ?? "",
        profileIds: [ACCOUNT_PROFILE_ID],
        isSpoiler: Boolean(apiLore.is_spoiler),
        dependsOn: (apiLore.depends_on ?? []).map(
          (each) => `${each.target_type}:${each.target_public_id}`,
        ),
        versionId: apiLore.latest_version_id,
        updatedAt: apiLore.updated_at,
        sort: 0,
      };
    }
    return {
      title: "",
      summary: "",
      content: "",
      status: "draft",
      groupId: groups.some(
        (group) => group.publicId === defaultGroupIdFromQuery,
      )
        ? defaultGroupIdFromQuery
        : "",
      profileIds: [ACCOUNT_PROFILE_ID],
      isSpoiler: false,
      dependsOn: [],
      versionId: null,
      sort: 0,
    };
  }, [apiLore, apiStory, apiVolumes, defaultGroupIdFromQuery, groups]);
  // 依賴可以是同專案的故事（不含冊）或其他設定
  const dependencyOptions = useMemo<DocumentDependencyOption[]>(
    () =>
      kind === "lore"
        ? [
            ...apiStories
              .filter((story) => !story.is_volume)
              .map((story) => ({
                kind: "story" as const,
                publicId: story.public_id,
                title: story.title,
                image: story.content_type === "image",
              })),
            ...apiLores
              .filter((lore) => lore.public_id !== documentId)
              .map((lore) => ({
                kind: "lore" as const,
                publicId: lore.public_id,
                title: lore.title,
              })),
          ]
        : [],
    [apiLores, apiStories, documentId, kind],
  );

  const shellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: t("web.home.workspace"), to: steamloomPath("my") },
    {
      label: t("web.projectWorkspace.projects"),
      to: steamloomPath("my/projects"),
    },
  ];
  const frame = (children: ReactNode) => (
    <StorytellerShell
      title={t(`web.documentEditor.page.editorTitle.${kind}`)}
      breadcrumbs={embedded ? [] : shellBreadcrumbs}
      plain={embedded}
    >
      {children}
    </StorytellerShell>
  );
  if (authLoading) {
    return frame(
      <Stack alignItems="center" sx={{ py: 8 }}>
        <Typography color="text.secondary">
          {t("web.home.checkingLogin")}
        </Typography>
      </Stack>,
    );
  }
  if (!session) {
    return frame(
      <CustomLoginRequiredState
        description={t(`web.documentEditor.page.loginDescription.${kind}`)}
        onLogin={() => void login()}
        submitting={submitting}
      />,
    );
  }
  if (
    (!apiProject && (projectsPending || projectsFetching)) ||
    (apiProject &&
      !isNew &&
      !loadedDocument &&
      (listQuery.isPending || listQuery.isFetching))
  ) {
    return frame(
      <StorytellerLoading
        label={t(`web.documentEditor.page.loading.${kind}`)}
      />,
    );
  }
  if (!apiProject || !documentId || (!isNew && !loadedDocument)) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={
          embedded
            ? steamloomPath(
                defaultGroupIdFromQuery
                  ? `my/workspace/${id}/${kind === "story" ? "stories" : "lores"}/${defaultGroupIdFromQuery}`
                  : kind === "story"
                    ? `my/workspace/${id}`
                    : `my/workspace/${id}/lores`,
              )
            : undefined
        }
      />
    );
  }
  const shellTitle =
    loadedDocument?.title ||
    (isNew
      ? t(`web.documentEditor.page.create.${kind}`)
      : t(`web.documentEditor.titlePlaceholder.${kind}`));

  return (
    <StorytellerShell
      title={shellTitle}
      breadcrumbs={
        embedded
          ? []
          : [
              ...shellBreadcrumbs,
              {
                label: apiProject.name,
                to: steamloomPath(`my/project/${apiProject.public_id}`),
              },
              {
                label: t(`web.documentEditor.page.listBreadcrumb.${kind}`),
                to: steamloomPath(
                  `my/project/${apiProject.public_id}/${kind === "story" ? "stories" : "lores"}`,
                ),
              },
              { label: shellTitle },
            ]
      }
      hideHeading
      plain={embedded}
      fitHeight={embedded}
    >
      <DocumentEditorBody
        key={`${kind}:${documentId}`}
        kind={kind}
        embedded={embedded}
        projectPublicId={apiProject.public_id}
        documentId={documentId}
        doc={doc}
        document={loadedDocument}
        groups={groups}
        dependencyOptions={dependencyOptions}
        userProfile={userProfile}
        agents={apiAgents}
        stories={apiStories}
        lores={apiLores}
      />
    </StorytellerShell>
  );
}

function DocumentEditorBody({
  kind,
  embedded,
  projectPublicId,
  documentId,
  doc,
  document,
  groups,
  dependencyOptions,
  userProfile,
  agents,
  stories,
  lores,
}: {
  kind: DocumentKind;
  embedded: boolean;
  projectPublicId: string;
  documentId: string;
  doc: EditingDocument;
  document?: StorytellerStory | StorytellerLore;
  groups: DocumentGroupOption[];
  dependencyOptions: DocumentDependencyOption[];
  userProfile?: StorytellerUserProfile;
  agents: StorytellerAgent[];
  stories: StorytellerStory[];
  lores: StorytellerLore[];
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceEditorBack = useWorkspaceEditorBack();
  const isNew = documentId === "new";
  const isHistoryRoute = location.pathname.endsWith("/diff");
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  }>({ open: false, message: "", severity: "success" });
  const notify = (message: string, severity: AlertColor = "success") =>
    setSnack({ open: true, message, severity });
  const notifyError = (fallback: string, error: unknown) =>
    notify(errorMessage(error, fallback), "error");
  // 新文件第一次存檔後要換成真正 public_id 的網址；等存檔提示關掉再換，作者看得到「已存檔」
  const [createdTarget, setCreatedTarget] = useState<string | null>(null);
  const [autoSaveMinutes, setAutoSaveMinutes] = useState<number | null>(() =>
    initialAutoSaveMinutes(userProfile),
  );
  // 自動存檔預設值取自設定頁，只在第一次拿到資料時套用，之後作者這次的調整不被重新整理蓋掉
  const autoSaveDefaultsAppliedRef = useRef(Boolean(userProfile));
  useEffect(() => {
    if (!userProfile || autoSaveDefaultsAppliedRef.current) return;
    autoSaveDefaultsAppliedRef.current = true;
    setAutoSaveMinutes(initialAutoSaveMinutes(userProfile));
  }, [userProfile]);

  const editing = useDocumentEditing({
    doc,
    adapter: useWebDocumentAdapter(kind, projectPublicId),
    autoSaveMinutes,
    messages: defaultDocumentEditingMessages(kind, t),
    notify,
    notifyError,
    onCreated: (publicId) =>
      setCreatedTarget(
        steamloomPath(
          embedded
            ? `my/workspace/${projectPublicId}/${kind}/${publicId}`
            : `my/project/${projectPublicId}/${kind}/${publicId}`,
        ),
      ),
  });
  const labels = useMemo(() => defaultDocumentEditorLabels(kind, t), [kind, t]);
  const agentEditorProps = useDocumentEditorAgentWorkspace({
    enabled: STORYTELLER_AI_ASSISTANT_ENABLED,
    kind,
    editing,
    projectPublicId,
    document,
    agents,
    stories,
    lores,
    penName: userProfile?.pen_name,
    notify,
  });

  // 離開前確認：重新整理／關閉分頁（beforeunload）與工作台的「回列表」／側邊欄切換共用同一份判斷。
  // 只註冊一次，事件觸發當下才讀最新的 editing
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  });
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editingRef.current.hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  // 工作台內嵌時登記離開確認（含「存檔並繼續」）；獨立頁面沒有側邊欄可攔
  useDocumentEditingLeaveGuard(editing, embedded);

  const pageTitle = isNew
    ? t(`web.documentEditor.page.create.${kind}`)
    : editing.draft.title.trim() ||
      document?.title ||
      t(`web.documentEditor.titlePlaceholder.${kind}`);
  useTitle(`${pageTitle} - ${STORYTELLER_APP_NAME}`, {
    path: steamloomPath(
      `my/project/${projectPublicId}/${kind}/${documentId}${isHistoryRoute ? "/diff" : ""}`,
    ),
    robots: "noindex, nofollow",
  });

  // 舊版獨立頁的故事：編輯歷史分頁對應 .../diff 網址
  const routeTab: DocumentEditorTab | undefined =
    !embedded && kind === "story" && !isNew
      ? isHistoryRoute
        ? "history"
        : "editor"
      : undefined;
  const changeRouteTab = (next: DocumentEditorTab) => {
    if (routeTab === undefined) return;
    const editorPath = steamloomPath(
      `my/project/${projectPublicId}/story/${documentId}`,
    );
    navigate(next === "history" ? `${editorPath}/diff` : editorPath);
  };

  return (
    <>
      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        autoHideDuration={createdTarget ? 1200 : 2500}
        onClose={() => {
          setSnack((current) => ({ ...current, open: false }));
          if (createdTarget) navigate(createdTarget);
          setCreatedTarget(null);
        }}
      />
      <SteamLoomDocumentEditor
        kind={kind}
        projectPublicId={projectPublicId}
        editing={editing}
        labels={labels}
        notify={notify}
        notifyError={notifyError}
        groups={groups}
        penName={userProfile?.pen_name}
        profiles={userProfile?.profiles ?? []}
        dependencyOptions={dependencyOptions}
        autoSaveMinutes={autoSaveMinutes}
        onAutoSaveMinutesChange={setAutoSaveMinutes}
        tab={routeTab}
        onTabChange={changeRouteTab}
        fillHeight={embedded}
        onBack={embedded ? (workspaceEditorBack ?? undefined) : undefined}
        editorProps={agentEditorProps}
      />
    </>
  );
}
