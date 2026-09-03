import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useRevertStorytellerLoreVersion,
  useSaveStorytellerLore,
  useStorytellerAgents,
  useStorytellerLoreCollections,
  useStorytellerLoreVersions,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerStories,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
  storytellerVersionSourceLabel,
} from "@/data/storyteller.ts";
import type { AlertColor } from "@mui/material";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StoryEditHistoryItem } from "@/pages/storyteller/StoryEditHistory.tsx";
import { type StorytellerAgentPanelAgent } from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import { StorytellerAgenticPanel } from "@/pages/storyteller/StorytellerAgenticPanel.tsx";
import { StoryEditorHistoryPanel } from "@/pages/storyteller/StoryEditorHistoryPanel.tsx";
import {
  StorytellerEditorSideTabs,
  type StorytellerEditorSidePanel,
} from "@/pages/storyteller/StorytellerEditorSideTabs.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import { StorytellerVersionCompareDialog } from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import { StoryWritingWorkspace } from "@/pages/storyteller/StoryWritingWorkspace.tsx";
import { StorytellerEditorOutlinePanel } from "@/pages/storyteller/StorytellerEditorOutlinePanel.tsx";
import { StorytellerEditorOutlineToggle } from "@/pages/storyteller/StorytellerEditorOutlineToggle.tsx";
import { useStorytellerEditorOutline } from "@/pages/storyteller/useStorytellerEditorOutline.ts";
import { registerWorkspaceLeaveGuard } from "@/pages/storyteller/WorkspaceLeaveGuard.ts";
import {
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSelectButton,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { useWorkspaceEditorBack } from "@/pages/storyteller/WorkspaceEditorBackContext.ts";
import { storytellerAssetTitle } from "@/pages/storyteller/storytellerAssetMarkdown.ts";
import {
  applyStorytellerAgentText,
  type StorytellerAgentTextSelection,
} from "@/pages/storyteller/storytellerAgentEditing.ts";
import {
  StorytellerWysiwygEditor,
  type StorytellerWysiwygEditorHandle,
} from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import type { StorytellerSelectionAgentTrigger } from "@/pages/storyteller/storytellerSelectionAgentTrigger.ts";
import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygCore/parser.ts";
import type {
  StorytellerAgenticProposal,
  StorytellerAsset,
} from "@/types/storyteller.ts";

const autoSaveIntervalMinutesMin = 2;
const autoSaveIntervalMinutesMax = 60;
const autoSaveIntervalMinutesDefault = 5;
const autoSavePresetMinutes = [2, 5, 10];

type AutoSaveSelectValue = "off" | "custom" | `${number}`;

function clampAutoSaveIntervalMinutes(value: number) {
  return Math.min(
    autoSaveIntervalMinutesMax,
    Math.max(autoSaveIntervalMinutesMin, Math.trunc(value)),
  );
}

interface LoreDraft {
  title: string;
  collectionId: string;
  content: string;
}

function serializeLoreDraft(
  title: string,
  collectionId: string,
  content: string,
) {
  return JSON.stringify({ title, collectionId, content });
}

// 字數只算段落實際文字，不含 marker id／comment 屬性／標題與對齊語法的符號——
// wordCount 顯示跟「離開頁面前要不要示警」的空白判斷都靠這個共用，不要分開重算兩次。
function loreContentWordCount(content: string) {
  const cleanText = parseMarkdownToParagraphs(content)
    .flatMap((paragraph) => paragraph.runs)
    .map((run) => run.text)
    .join("");
  return cleanText.replace(/\s+/g, "").length;
}

// 標題跟內容都是空的，就算跟已存檔版本不同也不用示警——沒有東西值得保護。
function isLoreDraftEmpty(title: string, content: string) {
  return title.trim() === "" && loreContentWordCount(content) === 0;
}

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

// 這個 repo 的 public_id 一律是 8 bytes 隨機數 hex 編碼（見後端 randomID），固定
// 16 個小寫十六進位字元——AI 提案裡的 collection_id 偶爾會出現不像這個形狀的
// 髒值（例如把工具參數說明文字整段誤當成參數值回傳），這種值送到後端只會撞回
// 400，且使用者完全看不出來是哪個欄位壞的。與其讓整次套用因為一個根本不像 id
// 的髒欄位失敗，不如當作「AI 沒有真的要動這個欄位」直接忽略、保留目前分類，
// 讓套用照樣能成功；欄位長得像合法 id 就正常信任，讓後端做最終的存在性驗證。
function looksLikeStorytellerPublicId(value: string) {
  return /^[0-9a-f]{16}$/.test(value);
}

export interface StorytellerLoreEditorProps {
  embedded?: boolean;
  projectId?: string;
  lorePublicId?: string;
}

export default function StorytellerLoreEditor({
  embedded = false,
  projectId,
  lorePublicId,
}: StorytellerLoreEditorProps = {}) {
  const workspaceEditorBack = useWorkspaceEditorBack();
  const params = useParams();
  const id = projectId ?? params.id;
  const loreId = lorePublicId ?? params.loreId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 從工作台指定分類建立新設定集時，工作台會在網址帶上 ?from=<collectionPublicId>，
  // 預設把新設定集放進使用者當下瀏覽的那個分類。
  const defaultCollectionIdFromQuery = searchParams.get("from") ?? "";
  const { session, loading: authLoading, login, submitting } = useAuth();
  const isNewLore = loreId === "new";
  const currentDraftRef = useRef(serializeLoreDraft("", "", ""));
  const lastSavedDraftRef = useRef(serializeLoreDraft("", "", ""));
  // 理由同 StoryEditor.tsx：WYSIWYG 編輯器掛載時可能對還沒 migrate 過的舊資料
  // 自動補 marker id，這不是使用者變更，掛載後第一次收到編輯器回報的內容時
  // 要把它當成新的存檔基準。
  const hasCapturedInitialEditorContentRef = useRef(false);
  const latestDraftRef = useRef<LoreDraft>({
    title: "",
    collectionId: "",
    content: "",
  });
  const autoSaveRunningRef = useRef(false);
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel | null>(
    null,
  );
  const [pendingSelectionAgentTrigger, setPendingSelectionAgentTrigger] =
    useState<StorytellerSelectionAgentTrigger | null>(null);
  const [title, setTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [content, setContent] = useState("");
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [snack, setSnack] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<AlertColor>("success");
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const editorRef = useRef<StorytellerWysiwygEditorHandle>(null);
  // 只存在這次編輯 session，不落 DB：初始值取自 profile 的全域預設，使用者可以依當次需要另外調整
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveIntervalMinutes, setAutoSaveIntervalMinutes] = useState(
    autoSaveIntervalMinutesDefault,
  );
  const [autoSaveIntervalInput, setAutoSaveIntervalInput] = useState(
    String(autoSaveIntervalMinutesDefault),
  );
  // 下拉選單顯示的模式獨立於 autoSaveIntervalMinutes 存在，
  // 否則選「自訂」時若剛好跟現有頻率同值（例如都是 5），畫面會立刻被推導邏輯打回原本的預設選項。
  const [autoSaveSelectValue, setAutoSaveSelectValue] =
    useState<AutoSaveSelectValue>(
      String(autoSaveIntervalMinutesDefault) as AutoSaveSelectValue,
    );
  const autoSaveDefaultsAppliedRef = useRef(false);
  // 存檔成功後端才發現這次帶的 base_version_id 已經不是最新版本（例如中途被
  // MCP 工具或另一個分頁動過）；內容還是照常存成新版本了，這裡只是提醒使用者
  // 去編輯歷史看一下，不會擋下存檔或自動存檔。
  const [versionConflict, setVersionConflict] = useState(false);
  const latestVersionIdRef = useRef<number | undefined>(undefined);
  const { data: userProfile } = useStorytellerUserProfile();

  const {
    data: apiProjects = [],
    isPending: projectsPending,
    isFetching: projectsFetching,
  } = useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const {
    data: apiLores = [],
    isPending: loresPending,
    isFetching: loresFetching,
  } = useStorytellerLores(apiProject?.public_id);
  const apiLore = apiLores.find((item) => item.public_id === loreId);
  const { data: loreCollections = [], isLoading: loreCollectionsLoading } =
    useStorytellerLoreCollections(apiProject?.public_id);
  const { data: apiStories = [] } = useStorytellerStories(
    apiProject?.public_id,
  );
  const { data: versions = [], isLoading: versionsLoading } =
    useStorytellerLoreVersions(apiProject?.public_id, apiLore?.public_id);
  const { data: agents = [] } = useStorytellerAgents();
  const saveLore = useSaveStorytellerLore(apiProject?.public_id);
  const saveLoreRef = useRef(saveLore);
  const revertLoreVersion = useRevertStorytellerLoreVersion(
    apiProject?.public_id,
    apiLore?.public_id,
  );
  const showSnack = (message: string, severity: AlertColor = "success") => {
    setSnack(message);
    setSnackSeverity(severity);
  };
  const outline = useStorytellerEditorOutline({
    projectPublicId: apiProject?.public_id,
    lorePublicId: apiLore?.public_id,
    onSnack: showSnack,
  });

  const project = apiProject
    ? { id: apiProject.public_id, name: apiProject.name }
    : undefined;
  const lore = apiLore
    ? {
        id: apiLore.public_id,
        title: apiLore.title,
        collectionId: apiLore.collection_id ?? "",
        content: apiLore.latest_content,
        updatedAt: apiLore.updated_at,
      }
    : undefined;
  const pageTitle = isNewLore
    ? "建立設定集"
    : title.trim() || lore?.title || "設定集";
  const wordCount = useMemo(() => loreContentWordCount(content), [content]);
  const panelAgents: StorytellerAgentPanelAgent[] = agents.map((agent) => ({
    id: String(agent.id),
    name: agent.name,
    provider: agent.provider,
    model: agent.model_name,
    prompt: agent.default_prompt,
    enabled: !agent.is_deleted,
  }));
  const loreHistoryItems: StoryEditHistoryItem[] = versions.map((version) => ({
    id: String(version.id),
    title: version.title,
    source: storytellerVersionSourceLabel(version.source),
    createdAt: version.created_at,
    words: version.word_count,
    revertedFromVersionId: version.reverted_from_version_id
      ? String(version.reverted_from_version_id)
      : null,
    conflictedWithVersionId: version.conflicted_with_version_id
      ? String(version.conflicted_with_version_id)
      : null,
  }));
  const selectedCollectionExists =
    selectedCollectionId === "" ||
    loreCollections.some(
      (collection) => collection.public_id === selectedCollectionId,
    );

  useEffect(() => {
    const defaultCollectionId = isNewLore
      ? (loreCollections.find(
          (collection) => collection.public_id === defaultCollectionIdFromQuery,
        )?.public_id ?? "")
      : (lore?.collectionId ?? "");
    setTitle(lore?.title ?? "");
    setSelectedCollectionId(defaultCollectionId);
    setContent(lore?.content ?? "");
    const savedDraft = serializeLoreDraft(
      lore?.title ?? "",
      defaultCollectionId,
      lore?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
    hasCapturedInitialEditorContentRef.current = false;
  }, [
    lore?.collectionId,
    lore?.content,
    lore?.title,
    isNewLore,
    defaultCollectionIdFromQuery,
    loreCollections,
  ]);

  useEffect(() => {
    latestVersionIdRef.current = versions[0]?.id;
    if (versions[0]?.conflicted_with_version_id != null) {
      setVersionConflict(true);
    }
  }, [versions]);

  useEffect(() => {
    currentDraftRef.current = serializeLoreDraft(
      title,
      selectedCollectionId,
      content,
    );
    latestDraftRef.current = {
      title,
      collectionId: selectedCollectionId,
      content,
    };
  }, [content, selectedCollectionId, title]);

  // 掛載後第一次收到編輯器回報的內容（可能已經過 marker id backfill）時，
  // 把它同時當成新的存檔基準，避免這次自動補值被誤判成使用者變更。
  function handleEditorContentChange(nextContent: string) {
    setContent(nextContent);
    if (!hasCapturedInitialEditorContentRef.current) {
      hasCapturedInitialEditorContentRef.current = true;
      lastSavedDraftRef.current = serializeLoreDraft(
        title,
        selectedCollectionId,
        nextContent,
      );
    }
  }

  // 判斷「有沒有值得保護的未存檔變更」——跟上次存檔的版本不同，且標題跟內容不是
  // 兩個都空白。beforeunload（瀏覽器層級離開）跟工作台的 leave guard（App 內
  // 「回列表」／側邊欄切換）共用同一份邏輯，不要各自重算一次。
  function hasUnsavedLoreChanges() {
    const isDirty = currentDraftRef.current !== lastSavedDraftRef.current;
    const isEmpty = isLoreDraftEmpty(
      latestDraftRef.current.title,
      latestDraftRef.current.content,
    );
    return isDirty && !isEmpty;
  }

  // 重新整理／關閉分頁前示警。只註冊一次（deps 是空陣列），事件觸發當下才去讀
  // ref 裡的最新值，不用每次打字都重新掛一次 listener。
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedLoreChanges()) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // embedded 模式下才需要讓工作台知道「離開前要不要確認」——非 embedded 的獨立頁面
  // 沒有工作台側邊欄／回列表按鈕可以攔。註冊的函式只讀 ref，不用隨著內容變動
  // 重新註冊，掛載時註冊一次、卸載時交給 cleanup 自動取消即可。
  useEffect(() => {
    if (!embedded) {
      return;
    }
    return registerWorkspaceLeaveGuard(hasUnsavedLoreChanges);
  }, [embedded]);

  useEffect(() => {
    saveLoreRef.current = saveLore;
  }, [saveLore]);

  // 編輯頁開關預設值取自 profile 設定，只在第一次拿到資料時套用一次，
  // 避免使用者在這次編輯 session 已經自己調整過，卻被之後的 profile 重新整理蓋掉。
  useEffect(() => {
    if (!userProfile || autoSaveDefaultsAppliedRef.current) {
      return;
    }
    autoSaveDefaultsAppliedRef.current = true;
    setAutoSaveEnabled(userProfile.auto_save_enabled);
    const interval = clampAutoSaveIntervalMinutes(
      userProfile.auto_save_interval_minutes || autoSaveIntervalMinutesDefault,
    );
    setAutoSaveIntervalMinutes(interval);
    setAutoSaveIntervalInput(String(interval));
    setAutoSaveSelectValue(
      !userProfile.auto_save_enabled
        ? "off"
        : autoSavePresetMinutes.includes(interval)
          ? (String(interval) as AutoSaveSelectValue)
          : "custom",
    );
  }, [userProfile]);

  function commitAutoSaveInterval() {
    const parsed = Number(autoSaveIntervalInput);
    const next =
      autoSaveIntervalInput.trim() === "" || !Number.isFinite(parsed)
        ? autoSaveIntervalMinutesDefault
        : clampAutoSaveIntervalMinutes(parsed);
    setAutoSaveIntervalMinutes(next);
    setAutoSaveIntervalInput(String(next));
  }

  function handleAutoSaveSelectChange(next: AutoSaveSelectValue) {
    setAutoSaveSelectValue(next);
    if (next === "off") {
      setAutoSaveEnabled(false);
      showSnack("已關閉自動存檔，記得手動存檔。");
      return;
    }
    setAutoSaveEnabled(true);
    if (next === "custom") {
      setAutoSaveIntervalInput(String(autoSaveIntervalMinutes));
      return;
    }
    const minutes = clampAutoSaveIntervalMinutes(Number(next));
    setAutoSaveIntervalMinutes(minutes);
    setAutoSaveIntervalInput(String(minutes));
    showSnack(`已設定每 ${minutes} 分鐘自動存檔。`);
  }

  useEffect(() => {
    if (!apiProject?.public_id || isNewLore || !lore?.id || !autoSaveEnabled) {
      return;
    }

    const timer = window.setInterval(
      () => {
        const currentDraft = currentDraftRef.current;
        const latestDraft = latestDraftRef.current;
        if (
          autoSaveRunningRef.current ||
          currentDraft === lastSavedDraftRef.current ||
          latestDraft.title.trim() === ""
        ) {
          return;
        }

        autoSaveRunningRef.current = true;
        saveLoreRef.current.mutate(
          {
            lorePublicId: lore.id,
            input: {
              title: latestDraft.title,
              collection_id: latestDraft.collectionId,
              content: latestDraft.content,
              save_trigger: "auto",
              base_version_id: latestVersionIdRef.current,
            },
          },
          {
            onSuccess: (savedLore) => {
              lastSavedDraftRef.current = currentDraft;
              showSnack("已自動存檔。");
              if (savedLore?.version_conflict) {
                setVersionConflict(true);
              }
            },
            onError: (error) => {
              showSnack(errorMessage(error, "設定集自動存檔失敗。"), "error");
            },
            onSettled: () => {
              autoSaveRunningRef.current = false;
            },
          },
        );
      },
      autoSaveIntervalMinutes * 60 * 1000,
    );

    return () => window.clearInterval(timer);
  }, [apiProject?.public_id, isNewLore, lore?.id, autoSaveEnabled, showSnack]);

  useTitle(`${pageTitle} - ${STORYTELLER_APP_NAME}`, {
    path: id && loreId ? steamloomPath(`my/project/${id}/lore/${loreId}`) : "",
    robots: "noindex, nofollow",
  });

  const loreShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: "我的工作台", to: steamloomPath("my") },
    { label: "創作專案", to: steamloomPath("my/projects") },
  ];

  // Ctrl/Cmd+S 手動存檔快捷鍵，跟 StoryEditor.tsx 同一套邏輯／同樣的理由
  // （Phase 9.5 人工測試反映的問題）。
  //
  // 已知 Bug 記錄：原本寫在 `if (authLoading)` 等 early return 之後，導致
  // 未登入／載入中的 render 不會呼叫這三個 hook，登入後才會呼叫，違反
  // Rules of Hooks（StoryEditor.tsx 也有同樣的問題，一起搬到這裡修）。
  // `handleSave` 是 function 宣告會整個 hoist，搬到 early return 之前一樣
  // 讀得到，不需要跟著搬。
  const handleSaveRef = useRef(handleSave);
  const isSavingLoreRef = useRef(saveLore.isPending);
  useEffect(() => {
    handleSaveRef.current = handleSave;
    isSavingLoreRef.current = saveLore.isPending;
  });
  useEffect(() => {
    function handleSaveHotkey(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      event.preventDefault();
      if (isSavingLoreRef.current) return;
      handleSaveRef.current();
    }
    window.addEventListener("keydown", handleSaveHotkey);
    return () => window.removeEventListener("keydown", handleSaveHotkey);
  }, []);

  if (authLoading) {
    return (
      <StorytellerShell
        title="設定集編輯器"
        breadcrumbs={embedded ? [] : loreShellBreadcrumbs}
        plain={embedded}
      >
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell
        title="設定集編輯器"
        breadcrumbs={embedded ? [] : loreShellBreadcrumbs}
        plain={embedded}
      >
        <CustomLoginRequiredState
          description="登入後即可編輯這份設定集。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (
    (!project && (projectsPending || projectsFetching)) ||
    (apiProject && !isNewLore && !lore && (loresPending || loresFetching))
  ) {
    return (
      <StorytellerShell
        title="設定集編輯器"
        breadcrumbs={embedded ? [] : loreShellBreadcrumbs}
        plain={embedded}
      >
        <StorytellerLoading label="正在載入設定集..." />
      </StorytellerShell>
    );
  }

  if (!project || (!isNewLore && !lore)) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={
          embedded
            ? steamloomPath(
                defaultCollectionIdFromQuery
                  ? `my/workspace/${id}/lores/${defaultCollectionIdFromQuery}`
                  : `my/workspace/${id}/lores`,
              )
            : undefined
        }
      />
    );
  }

  function insertAsset(asset: StorytellerAsset) {
    const inserted = editorRef.current?.insertAsset({
      publicId: asset.public_id,
      src: asset.preview_url,
      alt: asset.alt_text || storytellerAssetTitle(asset),
      projectPublicId: apiProject?.public_id,
    });
    setAssetPickerOpen(false);
    showSnack(inserted ? "已插入資產。" : "無法插入資產，請重新整理後再試。");
  }

  function handleSave() {
    const projectID = project?.id;
    if (!projectID) {
      showSnack("找不到專案資料，無法儲存設定集。", "error");
      return;
    }
    saveLore.mutate(
      {
        lorePublicId: isNewLore ? undefined : lore?.id,
        input: {
          title,
          collection_id: selectedCollectionId,
          content,
          save_trigger: "manual",
          base_version_id: isNewLore ? undefined : latestVersionIdRef.current,
        },
      },
      {
        onSuccess: (savedLore) => {
          lastSavedDraftRef.current = currentDraftRef.current;
          showSnack("設定集已存檔。");
          if (isNewLore && savedLore?.public_id) {
            // embedded（工作台）模式下要留在工作台右欄，把網址從 .../lore/new
            // 換成存好之後的真正 public_id，不能跳回舊版獨立編輯頁。
            navigate(
              steamloomPath(
                embedded
                  ? `my/workspace/${projectID}/lore/${savedLore.public_id}`
                  : `my/project/${projectID}/lore/${savedLore.public_id}`,
              ),
            );
          }
          if (savedLore?.version_conflict) {
            setVersionConflict(true);
          }
        },
        onError: (error) => {
          showSnack(errorMessage(error, "設定集存檔失敗。"), "error");
        },
      },
    );
  }

  // AI 助理提案卡片「套用提案」在提案目標剛好是目前這篇設定集時走這條路：把
  // 提案帶的欄位填進編輯區、立刻用一般存檔 API 存一次（save_trigger 特別標成
  // agent_apply，編輯歷史看得出這個版本是套用 AI 提案存的），失敗時整個
  // reject，讓呼叫端（StorytellerAgenticProposalCard）知道不能把提案標成已
  // 套用。沒帶到的欄位維持目前畫面上的值不動，不會被清空。
  async function applyAgenticProposalToEditor(
    proposal: StorytellerAgenticProposal,
  ) {
    const args = proposal.arguments;
    const nextTitle = typeof args.title === "string" ? args.title : title;
    // 段落 markerId 不用在這裡處理——後端存檔時統一補齊（見
    // backfillStoryMarkerIds），這裡送什麼內容過去都不用擔心。
    const nextContent =
      typeof args.content === "string" ? args.content : content;
    const nextCollectionId =
      typeof args.collection_id === "string" &&
      (args.collection_id === "" ||
        looksLikeStorytellerPublicId(args.collection_id))
        ? args.collection_id
        : selectedCollectionId;

    setTitle(nextTitle);
    setContent(nextContent);
    setSelectedCollectionId(nextCollectionId);

    const projectID = project?.id;
    if (!projectID || isNewLore) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      saveLore.mutate(
        {
          lorePublicId: lore?.id,
          input: {
            title: nextTitle,
            collection_id: nextCollectionId,
            content: nextContent,
            save_trigger: "agent_apply",
            base_version_id: latestVersionIdRef.current,
          },
        },
        {
          onSuccess: (savedLore) => {
            // 後端存檔時會補齊段落 markerId（見 backfillStoryMarkerIds），實際存進
            // DB 的內容跟這裡送出去的 nextContent 不會逐字一樣——改用回應帶回來的
            // latest_content 同步編輯區，不然編輯區顯示的 markerId 會跟資料庫裡的
            // 對不上（各自隨機產生），書籤等功能定位會失準。
            const savedContent = savedLore?.latest_content ?? nextContent;
            setContent(savedContent);
            const savedDraft = serializeLoreDraft(
              nextTitle,
              nextCollectionId,
              savedContent,
            );
            currentDraftRef.current = savedDraft;
            lastSavedDraftRef.current = savedDraft;
            showSnack("已套用 AI 提案並存檔。");
            if (savedLore?.version_conflict) {
              setVersionConflict(true);
            }
            resolve();
          },
          onError: (error) => {
            showSnack(errorMessage(error, "套用 AI 提案存檔失敗。"), "error");
            reject(
              error instanceof Error
                ? error
                : new Error("套用 AI 提案存檔失敗。"),
            );
          },
        },
      );
    });
  }

  function applyAgentText(
    result: string,
    action: "replace" | "insert" | "append" | "copy",
    resultSelection: StorytellerAgentTextSelection | null,
  ) {
    // target 固定傳 null：插入游標/取代選取這兩個需要 textarea 游標位置的動作
    // 這次先停用（UI 上也隱藏了對應按鈕），實際只會走得到 append/copy 這兩條路徑，
    // 兩者都是純字串操作，不需要 target。
    applyStorytellerAgentText({
      result,
      action,
      content,
      resultSelection,
      target: null,
      setContent,
      onCopy: () => showSnack("AI 回應已複製。"),
      onSelectionMismatch: () =>
        showSnack("選取範圍已變更，請改用插入或複製。", "error"),
      onAfterApply: () => {},
    });
  }

  function isRightVersionDisabled(versionId: string) {
    const version = loreHistoryItems.find((item) => item.id === versionId);
    const leftVersion = loreHistoryItems.find(
      (item) => item.id === leftVersionId,
    );
    if (!version || !leftVersion || version.id === leftVersion.id) {
      return true;
    }
    return new Date(version.createdAt) <= new Date(leftVersion.createdAt);
  }

  function handleLeftVersionChange(versionId: string) {
    setLeftVersionId(versionId);
    const nextLeftVersion = loreHistoryItems.find(
      (item) => item.id === versionId,
    );
    const selectedRightVersion = loreHistoryItems.find(
      (item) => item.id === rightVersionId,
    );
    if (
      !nextLeftVersion ||
      !selectedRightVersion ||
      selectedRightVersion.id === nextLeftVersion.id ||
      new Date(selectedRightVersion.createdAt) <=
        new Date(nextLeftVersion.createdAt)
    ) {
      setRightVersionId("");
    }
  }

  function handleSelectionAgentTrigger(
    trigger: StorytellerSelectionAgentTrigger,
  ) {
    setPendingSelectionAgentTrigger(trigger);
    setSidePanel("agentic");
  }

  // 版本比對改用 modal 顯示，不用再走獨立頁面——versions 本來就已經載入每個版本的
  // 完整 content，直接從這裡找出使用者選的左右版本傳給 dialog。
  const leftCompareVersion = versions.find(
    (version) => String(version.id) === leftVersionId,
  );
  const rightCompareVersion = versions.find(
    (version) => String(version.id) === rightVersionId,
  );

  const collectionOptions = [
    { value: "", label: "未分類", icon: <FolderIcon fontSize="small" /> },
    ...(!selectedCollectionExists
      ? [
          {
            value: selectedCollectionId,
            label: "目前分類",
            icon: <FolderIcon fontSize="small" />,
          },
        ]
      : []),
    ...loreCollections.map((collection) => ({
      value: collection.public_id,
      label: collection.name,
      icon: <FolderIcon fontSize="small" />,
    })),
  ];
  const autoSaveOptions = [
    {
      value: "off",
      label: "不自動存檔",
      icon: <ScheduleIcon fontSize="small" />,
    },
    ...autoSavePresetMinutes.map((minutes) => ({
      value: String(minutes),
      label: `每 ${minutes} 分鐘`,
      icon: <ScheduleIcon fontSize="small" />,
    })),
    {
      value: "custom",
      label: "自訂頻率",
      icon: <ScheduleIcon fontSize="small" />,
    },
  ];
  // 字數／更新時間／自動存檔狀態集中成同一組內容：獨立頁仍顯示在頁首 action，
  // embedded 寫作頁則下放到底部狀態列，避免長標題被擠壓。
  const loreEditorActionContent = (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      <Chip label={`${wordCount.toLocaleString()} 字`} />
      {lore ? (
        <>
          <Chip label={`更新於 ${formatStorytellerDate(lore.updatedAt)}`} />
          {apiProject && (
            <Chip
              color={autoSaveEnabled ? "success" : "default"}
              variant="outlined"
              label={
                autoSaveEnabled
                  ? `每 ${autoSaveIntervalMinutes} 分鐘自動存檔`
                  : "自動存檔已關閉"
              }
            />
          )}
        </>
      ) : (
        <Chip label="尚未存檔" color="warning" />
      )}
    </Stack>
  );
  const loreEditorBottomStatusContent = embedded ? (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      {workspaceEditorBack && (
        <Button
          size="small"
          variant="text"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={workspaceEditorBack}
          sx={{ flexShrink: 0, color: "text.secondary" }}
        >
          回列表
        </Button>
      )}
      {loreEditorActionContent}
    </Stack>
  ) : undefined;
  const loreEditorBottomActionContent = embedded ? (
    // disabled 的原生 button 不會觸發滑鼠事件，Tooltip 需要包一層 span
    // 才能在按鈕 disabled 時（存檔中）依然收得到 hover 事件顯示提示。
    <Tooltip title="快捷鍵：Ctrl+S／⌘S">
      <span>
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saveLore.isPending}
          onClick={handleSave}
          sx={{ minWidth: 88 }}
        >
          {saveLore.isPending ? "存檔中" : "存檔"}
        </Button>
      </span>
    </Tooltip>
  ) : undefined;
  const loreEditorHeaderContent = embedded ? (
    <Box
      sx={{
        // 跟 StoryEditor.tsx 同一套理由／同一套做法：sticky 釘在工作台右欄
        // 面板頂部，捲動編輯器內文時標題／摘要／存檔按鈕維持在畫面上。
        position: "sticky",
        top: 0,
        zIndex: 2,
        pb: 1,
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#191919" : "#ffffff",
      }}
    >
      <Box sx={{ width: 1 }}>
        <Stack
          spacing={1.25}
          sx={{
            width: 1,
            maxWidth: 920,
            mx: "auto",
          }}
        >
          {versionConflict ? (
            <Alert
              severity="warning"
              variant="outlined"
              onClose={() => setVersionConflict(false)}
              action={
                <Button
                  size="small"
                  onClick={() => {
                    setSidePanel("history");
                    setVersionConflict(false);
                  }}
                >
                  查看編輯歷史
                </Button>
              }
            >
              剛剛存檔完成後才發現這篇設定集在中途被更新過，已經接在最新版本後面存成新版了。
            </Alert>
          ) : (
            saveLore.isError && (
              <Alert severity="error" variant="outlined">
                {errorMessage(saveLore.error, "設定集存檔失敗。")}
              </Alert>
            )
          )}
          <WorkspaceEditorHeaderRow
            title={
              <WorkspaceEditableTitle
                value={title}
                onChange={setTitle}
                placeholder="未命名設定集"
              />
            }
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <WorkspaceEditorSelectButton
              icon={<FolderIcon fontSize="small" />}
              label="分類"
              value={selectedCollectionId}
              options={collectionOptions}
              disabled={loreCollectionsLoading}
              onChange={setSelectedCollectionId}
            />
            {apiProject && (
              <WorkspaceEditorSelectButton
                icon={<ScheduleIcon fontSize="small" />}
                label="自動存檔"
                value={autoSaveSelectValue}
                options={autoSaveOptions}
                onChange={(value) =>
                  handleAutoSaveSelectChange(value as AutoSaveSelectValue)
                }
              >
                {autoSaveSelectValue === "custom" && (
                  <TextField
                    type="number"
                    size="small"
                    label={`${autoSaveIntervalMinutesMin}-${autoSaveIntervalMinutesMax} 分鐘`}
                    value={autoSaveIntervalInput}
                    slotProps={{
                      htmlInput: {
                        min: autoSaveIntervalMinutesMin,
                        max: autoSaveIntervalMinutesMax,
                        step: 1,
                      },
                    }}
                    onChange={(event) =>
                      setAutoSaveIntervalInput(event.target.value)
                    }
                    onBlur={commitAutoSaveInterval}
                    sx={{ width: 140 }}
                  />
                )}
              </WorkspaceEditorSelectButton>
            )}
          </Stack>
        </Stack>
      </Box>
    </Box>
  ) : (
    <Stack spacing={2}>
      {versionConflict ? (
        <Alert
          severity="warning"
          variant="outlined"
          onClose={() => setVersionConflict(false)}
          action={
            <Button
              size="small"
              onClick={() => {
                setSidePanel("history");
                setVersionConflict(false);
              }}
            >
              查看編輯歷史
            </Button>
          }
        >
          剛剛存檔完成後才發現這篇設定集在中途被更新過（可能是另一個分頁，或透過
          MCP
          連上的工具），已經接在最新版本後面存成新版了，方便的話去編輯歷史確認一下有沒有需要注意的地方。
        </Alert>
      ) : (
        saveLore.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(saveLore.error, "設定集存檔失敗。")}
          </Alert>
        )
      )}
      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="設定集標題"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            required
            placeholder="請輸入設定集標題"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            fullWidth
            label="分類"
            value={selectedCollectionId}
            disabled={loreCollectionsLoading}
            onChange={(event) => setSelectedCollectionId(event.target.value)}
          >
            <MenuItem value="">未分類</MenuItem>
            {!selectedCollectionExists && (
              <MenuItem value={selectedCollectionId}>目前分類</MenuItem>
            )}
            {loreCollections.map((collection) => (
              <MenuItem key={collection.public_id} value={collection.public_id}>
                {collection.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {apiProject && (
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <TextField
                select
                fullWidth
                label="自動存檔"
                value={autoSaveSelectValue}
                onChange={(event) =>
                  handleAutoSaveSelectChange(
                    event.target.value as AutoSaveSelectValue,
                  )
                }
              >
                <MenuItem value="off">不自動存檔</MenuItem>
                {autoSavePresetMinutes.map((minutes) => (
                  <MenuItem key={minutes} value={String(minutes)}>
                    每 {minutes} 分鐘
                  </MenuItem>
                ))}
                <MenuItem value="custom">自訂頻率…</MenuItem>
              </TextField>
              {autoSaveSelectValue === "custom" && (
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  label={`自訂頻率（${autoSaveIntervalMinutesMin}-${autoSaveIntervalMinutesMax} 分鐘）`}
                  value={autoSaveIntervalInput}
                  slotProps={{
                    htmlInput: {
                      min: autoSaveIntervalMinutesMin,
                      max: autoSaveIntervalMinutesMax,
                      step: 1,
                    },
                  }}
                  onChange={(event) =>
                    setAutoSaveIntervalInput(event.target.value)
                  }
                  onBlur={commitAutoSaveInterval}
                />
              )}
            </Stack>
          </Grid>
        )}
        <Grid size={{ xs: 12, md: 2 }}>
          {/* Button 有 fullWidth，包裹用的 span 要是 block 才不會把寬度收縮
              回內容寬度。 */}
          <Tooltip title="快捷鍵：Ctrl+S／⌘S">
            <span style={{ display: "block" }}>
              <Button
                fullWidth
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={handleSave}
                disabled={saveLore.isPending}
                sx={{ py: 1.7 }}
              >
                {saveLore.isPending ? "存檔中" : "存檔"}
              </Button>
            </span>
          </Tooltip>
        </Grid>
      </Grid>
    </Stack>
  );

  return (
    <StorytellerShell
      title={pageTitle}
      breadcrumbs={
        embedded
          ? []
          : [
              { label: STORYTELLER_APP_NAME, to: steamloomPath() },
              { label: "我的工作台", to: steamloomPath("my") },
              { label: "創作專案", to: steamloomPath("my/projects") },
              {
                label: project.name,
                to: steamloomPath(`my/project/${project.id}`),
              },
              {
                label: "設定集",
                to: steamloomPath(`my/project/${project.id}/lores`),
              },
              { label: pageTitle },
            ]
      }
      action={embedded ? undefined : loreEditorActionContent}
      hideHeading
      plain={embedded}
      fitHeight={embedded}
      headerContent={loreEditorHeaderContent}
    >
      <StoryWritingWorkspace
        editor={
          <StorytellerWysiwygEditor
            ref={editorRef}
            value={content}
            onChange={handleEditorContentChange}
            toolbarPlacement={embedded ? "bottom" : "top"}
            fitParentHeight={embedded}
            bottomStatusContent={loreEditorBottomStatusContent}
            bottomActionContent={loreEditorBottomActionContent}
            exportBaseName={title}
            projectPublicId={apiProject?.public_id}
            hasSavedTarget={Boolean(apiLore?.public_id)}
            onSelectionAgentTrigger={handleSelectionAgentTrigger}
            onRequestInsertAsset={
              project ? () => setAssetPickerOpen(true) : undefined
            }
            toolbarStart={
              <StorytellerEditorOutlineToggle
                open={outline.outlineOpen}
                onToggle={outline.setOutlineOpen}
              />
            }
            bookmarkedMarkerIds={outline.bookmarkedMarkerIds}
            canBookmark={outline.canBookmark}
            onAddBookmark={outline.addBookmark}
            onRemoveBookmark={outline.removeBookmark}
            onEditorReady={outline.onEditorReady}
            toolbarExtra={
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="插入資產">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!project}
                      onClick={() => setAssetPickerOpen(true)}
                      aria-label="插入資產"
                    >
                      <ImageIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <StorytellerEditorSideTabs
                  value={sidePanel}
                  onChange={setSidePanel}
                  historyDisabled={isNewLore}
                  aiTabHidden
                />
              </Stack>
            }
          />
        }
        leftDock={
          outline.outlineOpen ? (
            <StorytellerEditorOutlinePanel
              editor={outline.editor}
              bookmarks={outline.bookmarks}
              loading={outline.bookmarksLoading}
              onDeleteBookmark={outline.removeBookmark}
              onUpdateBookmarkNote={outline.saveBookmarkNote}
            />
          ) : null
        }
        dock={
          sidePanel && (
            <>
              {sidePanel === "history" && (
                <StoryEditorHistoryPanel
                  items={loreHistoryItems}
                  allItems={loreHistoryItems}
                  loading={versionsLoading}
                  leftVersionId={leftVersionId}
                  rightVersionId={rightVersionId}
                  onCompare={() => setCompareDialogOpen(true)}
                  onLeftVersionChange={handleLeftVersionChange}
                  onRightVersionChange={setRightVersionId}
                  isRightVersionDisabled={isRightVersionDisabled}
                  isNewStory={isNewLore}
                  newItemMessage="設定集第一次存檔後才會產生編輯歷史。"
                  currentVersionId={
                    versions[0]?.id !== undefined
                      ? String(versions[0].id)
                      : undefined
                  }
                  revertingVersionId={
                    revertLoreVersion.isPending
                      ? String(revertLoreVersion.variables)
                      : null
                  }
                  onRevert={(versionId) => {
                    revertLoreVersion.mutate(Number(versionId), {
                      onSuccess: () => {
                        setVersionConflict(false);
                        showSnack("已回復到這個版本。");
                      },
                    });
                  }}
                />
              )}

              {sidePanel === "agentic" && (
                <StorytellerAgenticPanel
                  targetKind="lore"
                  presentation="floatingDock"
                  projectPublicId={apiProject?.public_id}
                  targetPublicId={apiLore?.public_id}
                  agents={panelAgents}
                  currentStory={{
                    title: title.trim() || apiLore?.title || "",
                    summary: "",
                    content,
                    versionId: apiLore?.latest_version_id ?? null,
                    updatedAt: apiLore?.updated_at ?? new Date().toISOString(),
                  }}
                  otherStories={apiStories.map((item) => ({
                    id: item.public_id,
                    title: item.title,
                    content: item.latest_content,
                  }))}
                  lores={apiLores
                    .filter((item) => item.public_id !== apiLore?.public_id)
                    .map((item) => ({
                      id: item.public_id,
                      title: item.title,
                      content: item.latest_content,
                    }))}
                  penName={userProfile?.pen_name}
                  onApplyText={applyAgentText}
                  onApplyProposalToEditor={applyAgenticProposalToEditor}
                  pendingSelectionAgentTrigger={pendingSelectionAgentTrigger}
                  onSelectionAgentTriggerApplied={() =>
                    setPendingSelectionAgentTrigger(null)
                  }
                />
              )}
            </>
          )
        }
        fillHeight={embedded}
      />
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity={snackSeverity}
        onClose={() => setSnack("")}
      />
      <StorytellerAssetPickerDialog
        open={assetPickerOpen}
        projectPublicId={apiProject?.public_id}
        title="插入設定資產"
        onClose={() => setAssetPickerOpen(false)}
        onSelect={insertAsset}
      />
      <StorytellerVersionCompareDialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        itemTitle={title.trim() || lore?.title || "設定集"}
        leftVersion={
          leftCompareVersion
            ? {
                title: leftCompareVersion.title,
                content: leftCompareVersion.content,
                source: storytellerVersionSourceLabel(
                  leftCompareVersion.source,
                ),
                createdAt: leftCompareVersion.created_at,
              }
            : null
        }
        rightVersion={
          rightCompareVersion
            ? {
                title: rightCompareVersion.title,
                content: rightCompareVersion.content,
                source: storytellerVersionSourceLabel(
                  rightCompareVersion.source,
                ),
                createdAt: rightCompareVersion.created_at,
              }
            : null
        }
      />
    </StorytellerShell>
  );
}
