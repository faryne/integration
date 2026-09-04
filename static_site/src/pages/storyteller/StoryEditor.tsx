import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ImageIcon from "@mui/icons-material/Image";
import FolderIcon from "@mui/icons-material/Folder";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
import type { AlertColor } from "@mui/material";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useRevertStorytellerStoryVersion,
  useSaveStorytellerStory,
  useStorytellerAgents,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerStoryVersions,
  useStorytellerStories,
  useStorytellerUserProfile,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
  storytellerAgents,
  storytellerVersionSourceLabel,
} from "@/data/storyteller.ts";
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
  WorkspaceEditableSummary,
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

const historyPerPage = 5;
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

interface EditorProject {
  id: string;
  name: string;
  description: string;
}

interface EditorStory {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "completed";
  content: string;
  updatedAt: string;
  sort: number;
  parentId: number | null;
}

interface EditorAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  purpose: string;
  enabled: boolean;
}

interface StoryDraft {
  title: string;
  summary: string;
  status: "draft" | "completed";
  content: string;
  sort: number;
  parentPublicId: string;
}

// 字數只算段落實際文字，不含 marker id／comment 屬性／標題與對齊語法的符號——
// wordCount 顯示跟「離開頁面前要不要示警」的空白判斷都靠這個共用，不要分開重算兩次。
function storyContentWordCount(content: string) {
  const cleanText = parseMarkdownToParagraphs(content)
    .flatMap((paragraph) => paragraph.runs)
    .map((run) => run.text)
    .join("");
  return cleanText.replace(/\s+/g, "").length;
}

// 標題跟內容都是空的，就算跟已存檔版本不同也不用示警——沒有東西值得保護，
// 使用者離開後頂多是回到空白畫面，不會有「辛苦寫的東西不見了」的感覺。
function isStoryDraftEmpty(title: string, content: string) {
  return title.trim() === "" && storyContentWordCount(content) === 0;
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
// 16 個小寫十六進位字元——AI 提案裡的 volume_public_id 偶爾會出現不像這個形狀
// 的髒值（例如把工具參數說明文字整段誤當成參數值回傳），這種值送到後端只會
// 撞回 400，而且使用者完全看不出來是哪個欄位壞的。與其讓整次套用因為一個根
// 本不像 id 的髒欄位失敗，不如當作「AI 沒有真的要動這個欄位」直接忽略、保留
// 目前的冊別，讓套用照樣能成功；欄位長得像合法 id 就正常信任、照樣送出去，
// 讓後端做最終的存在性驗證。
function looksLikeStorytellerPublicId(value: string) {
  return /^[0-9a-f]{16}$/.test(value);
}

function serializeStoryDraft(
  title: string,
  summary: string,
  status: "draft" | "completed",
  parentPublicId: string,
  content: string,
) {
  return JSON.stringify({
    title,
    summary,
    status,
    parentPublicId,
    content,
  });
}

export interface StorytellerStoryEditorProps {
  embedded?: boolean;
  projectId?: string;
  storyPublicId?: string;
}

export default function StorytellerStoryEditor({
  embedded = false,
  projectId,
  storyPublicId,
}: StorytellerStoryEditorProps = {}) {
  const workspaceEditorBack = useWorkspaceEditorBack();
  const params = useParams();
  const id = projectId ?? params.id;
  const storyId = storyPublicId ?? params.storyId;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const isNewStory = storyId === "new";
  // 從工作台指定冊建立新故事時，工作台會在網址帶上 ?from=<volumePublicId>，
  // 用來預設把新故事放進使用者當下瀏覽的那一冊；不是新故事、或帶的值不是真的
  // 存在的冊（例如 from=未分冊的內部代號）就不採用，交給下面既有邏輯處理。
  const defaultVolumeIdFromQuery = searchParams.get("from") ?? "";
  const isHistoryRoute = location.pathname.endsWith("/diff");
  const {
    data: apiProjects = [],
    isPending: apiProjectsPending,
    isFetching: apiProjectsFetching,
  } = useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const project: EditorProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
      }
    : undefined;
  const {
    data: apiStories = [],
    isPending: apiStoriesPending,
    isFetching: apiStoriesFetching,
  } = useStorytellerStories(apiProject?.public_id);
  const { data: apiLores = [] } = useStorytellerLores(apiProject?.public_id);
  const { data: apiVolumes = [] } = useStorytellerVolumes(
    apiProject?.public_id,
  );
  const apiStory = apiStories.find((item) => item.public_id === storyId);
  const story: EditorStory | undefined = apiStory
    ? {
        id: apiStory.public_id,
        title: apiStory.title,
        summary: apiStory.summary,
        status: apiStory.status,
        content: apiStory.latest_content,
        updatedAt: apiStory.updated_at,
        sort: apiStory.sort,
        parentId: apiStory.parent_id,
      }
    : undefined;
  const { data: apiAgents = [] } = useStorytellerAgents();
  const { data: userProfile } = useStorytellerUserProfile();
  const agentRows: EditorAgent[] =
    apiAgents.length > 0
      ? apiAgents.map((agent) => ({
          id: String(agent.id),
          name: agent.name,
          provider: agent.provider,
          model: agent.model_name,
          purpose: agent.default_prompt,
          enabled: !agent.is_deleted,
        }))
      : storytellerAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          provider: agent.provider,
          model: agent.model,
          purpose: agent.purpose,
          enabled: agent.enabled,
        }));
  const saveStory = useSaveStorytellerStory(apiProject?.public_id);
  const revertStoryVersion = useRevertStorytellerStoryVersion(
    apiProject?.public_id,
    apiStory?.public_id,
  );
  const { data: apiStoryVersions = [], isLoading: apiStoryVersionsLoading } =
    useStorytellerStoryVersions(apiProject?.public_id, apiStory?.public_id);
  const [storyTitle, setStoryTitle] = useState(story?.title ?? "");
  const [storySummary, setStorySummary] = useState(story?.summary ?? "");
  const [storyStatus, setStoryStatus] = useState<"draft" | "completed">(
    story?.status ?? "draft",
  );
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel | null>(
    isHistoryRoute ? "history" : null,
  );
  const [pendingSelectionAgentTrigger, setPendingSelectionAgentTrigger] =
    useState<StorytellerSelectionAgentTrigger | null>(null);
  const [content, setContent] = useState(story?.content ?? "");
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
  const [saveMessageVisible, setSaveMessageVisible] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageSeverity, setSaveMessageSeverity] =
    useState<AlertColor>("success");
  const showEditorSnack = (
    message: string,
    severity: AlertColor = "success",
  ) => {
    setSaveMessage(message);
    setSaveMessageSeverity(severity);
    setSaveMessageVisible(true);
  };
  const outline = useStorytellerEditorOutline({
    projectPublicId: apiProject?.public_id,
    storyPublicId: apiStory?.public_id,
    onSnack: showEditorSnack,
  });
  // 存檔成功後端才發現這次帶的 base_version_id 已經不是最新版本（例如中途被
  // MCP 工具或另一個分頁動過）；內容還是照常存成新版本了，這裡只是提醒使用者
  // 去編輯歷史看一下，不會擋下存檔或自動存檔。
  const [versionConflict, setVersionConflict] = useState(false);
  const latestVersionIdRef = useRef<number | undefined>(undefined);
  const [leftDiffId, setLeftDiffId] = useState("");
  const [rightDiffId, setRightDiffId] = useState("");
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const currentDraftRef = useRef(
    serializeStoryDraft("", "", "completed", "", ""),
  );
  const lastSavedDraftRef = useRef(
    serializeStoryDraft("", "", "completed", "", ""),
  );
  // WYSIWYG 編輯器掛載時可能會對還沒 migrate 過的舊資料自動補 marker id
  // （見 markerParagraph.ts 的 backfillMarkerIds），這個補值動作會經由
  // onChange 回報一次「跟原始存檔內容不同」的字串——這不是使用者手動編輯，
  // 不該被當成未存檔變更。掛載後第一次收到編輯器回報的內容時，把它視為新的
  // 存檔基準，而不是拿 API 回來的原始字串當基準。
  const hasCapturedInitialEditorContentRef = useRef(false);
  // 上面那份「當成已存檔」的基準只解決離開前的誤報警告，不代表 backfill 出來的
  // markerId 真的送進後端過。加書籤依賴 markerId 已經落地，這裡另外獨立記一個
  // 「這次 backfill 有沒有真的動到內容、但還沒存檔」的旗標，只給
  // handleAddBookmarkWithSave 用，不影響 hasUnsavedStoryChanges／離開前警告。
  const hasUnpersistedMarkerBackfillRef = useRef(false);
  const latestDraftRef = useRef<StoryDraft>({
    title: "",
    summary: "",
    status: "completed",
    content: "",
    sort: 0,
    parentPublicId: "",
  });
  const saveStoryRef = useRef(saveStory);
  const autoSaveRunningRef = useRef(false);
  const pageTitle = isNewStory
    ? "建立故事"
    : storyTitle.trim() || story?.title || "未命名故事";
  const storyDiffs: StoryEditHistoryItem[] = apiStory
    ? apiStoryVersions.map((version) => ({
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
      }))
    : [];
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(storyDiffs.length / historyPerPage),
  );
  const visibleStoryDiffs = storyDiffs.slice(
    (historyPage - 1) * historyPerPage,
    historyPage * historyPerPage,
  );
  // 版本比對改用 modal 顯示，不用再走獨立頁面——apiStoryVersions 本來就已經載入
  // 每個版本的完整 content，直接從這裡找出使用者選的左右版本傳給 dialog，不用
  // 像舊版獨立頁面那樣另外發請求重新拉一次。
  const leftCompareVersion = apiStoryVersions.find(
    (version) => String(version.id) === leftDiffId,
  );
  const rightCompareVersion = apiStoryVersions.find(
    (version) => String(version.id) === rightDiffId,
  );
  const leftDiff = storyDiffs.find((diff) => diff.id === leftDiffId);
  const panelAgents: StorytellerAgentPanelAgent[] = agentRows.map((agent) => ({
    id: agent.id,
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    prompt: agent.purpose,
    enabled: agent.enabled,
  }));
  const agenticOtherStories = apiStories
    .filter((item) => item.public_id !== apiStory?.public_id)
    .map((item) => ({
      id: item.public_id,
      title: item.title,
      content: item.latest_content,
    }));
  const agenticLores = apiLores.map((item) => ({
    id: item.public_id,
    title: item.title,
    content: item.latest_content,
  }));

  useEffect(() => {
    if (isHistoryRoute) {
      setSidePanel("history");
    }
  }, [isHistoryRoute]);

  useEffect(() => {
    latestVersionIdRef.current = apiStoryVersions[0]?.id;
    // 最新版本本身就帶著衝突標記時也要顯示提示，不只靠這次存檔當下的回應——
    // 這樣就算使用者錯過當下的提示（例如自動存檔時人不在畫面前），重新整理或
    // 回來看編輯頁時一樣看得到。
    if (apiStoryVersions[0]?.conflicted_with_version_id != null) {
      setVersionConflict(true);
    }
  }, [apiStoryVersions]);

  useEffect(() => {
    setStoryTitle(story?.title ?? "");
    setStorySummary(story?.summary ?? "");
    setStoryStatus(story?.status ?? "draft");
    setContent(story?.content ?? "");
    const parentVolume = apiVolumes.find(
      (volume) => volume.id === story?.parentId,
    );
    if (isNewStory) {
      const defaultVolume = apiVolumes.find(
        (volume) => volume.public_id === defaultVolumeIdFromQuery,
      );
      setSelectedVolumeId(defaultVolume?.public_id ?? "");
    } else if (story?.parentId === null || parentVolume) {
      setSelectedVolumeId(parentVolume?.public_id ?? "");
    }
    const savedDraft = serializeStoryDraft(
      story?.title ?? "",
      story?.summary ?? "",
      story?.status ?? "draft",
      parentVolume?.public_id ?? "",
      story?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
    hasCapturedInitialEditorContentRef.current = false;
  }, [
    apiVolumes,
    defaultVolumeIdFromQuery,
    isNewStory,
    story?.content,
    story?.parentId,
    story?.status,
    story?.summary,
    story?.title,
  ]);

  useEffect(() => {
    currentDraftRef.current = serializeStoryDraft(
      storyTitle,
      storySummary,
      storyStatus,
      selectedVolumeId,
      content,
    );
    latestDraftRef.current = {
      title: storyTitle,
      summary: storySummary,
      status: storyStatus,
      content,
      sort: story?.sort ?? 0,
      parentPublicId: selectedVolumeId,
    };
  }, [
    content,
    selectedVolumeId,
    story?.sort,
    storyStatus,
    storySummary,
    storyTitle,
  ]);

  // 掛載後第一次收到編輯器回報的內容（可能已經過 marker id backfill）時，
  // 把它當成新的存檔基準，避免這次自動補值被誤判成使用者變更、跳出不必要的
  // 「離開前確認」——這對使用者來說是「我什麼都沒做」，不該被當成髒狀態。
  //
  // 但如果 backfill 真的改了內容（代表這篇故事是還沒被這次補值邏輯處理過的
  // 舊資料），這個新內容其實還沒真的存進後端。書籤存的 markerId 依賴的正是
  // 「已存檔」狀態，所以另外用 hasUnpersistedMarkerBackfillRef 單獨記著這件
  // 事，只讓 handleAddBookmarkWithSave 拿來判斷要不要先強制存一次——不透過
  // hasUnsavedStoryChanges()／lastSavedDraftRef，才不會連帶讓離開前警告
  // 對「使用者根本沒碰過的文件」誤報。
  function handleEditorContentChange(nextContent: string) {
    setContent(nextContent);
    if (!hasCapturedInitialEditorContentRef.current) {
      hasCapturedInitialEditorContentRef.current = true;
      hasUnpersistedMarkerBackfillRef.current =
        nextContent !== (story?.content ?? "");
      lastSavedDraftRef.current = serializeStoryDraft(
        storyTitle,
        storySummary,
        storyStatus,
        selectedVolumeId,
        nextContent,
      );
    }
  }

  // 判斷「有沒有值得保護的未存檔變更」——跟上次存檔的版本不同，且標題跟內容不是
  // 兩個都空白。beforeunload（瀏覽器層級離開）跟工作台的 leave guard（App 內
  // 「回列表」／側邊欄切換）共用同一份邏輯，不要各自重算一次。
  function hasUnsavedStoryChanges() {
    const isDirty = currentDraftRef.current !== lastSavedDraftRef.current;
    const isEmpty = isStoryDraftEmpty(
      latestDraftRef.current.title,
      latestDraftRef.current.content,
    );
    return isDirty && !isEmpty;
  }

  // 重新整理／關閉分頁前示警。只註冊一次（deps 是空陣列），事件觸發當下才去讀
  // ref 裡的最新值，不用每次打字都重新掛一次 listener。
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedStoryChanges()) {
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
    return registerWorkspaceLeaveGuard(hasUnsavedStoryChanges);
  }, [embedded]);

  useEffect(() => {
    saveStoryRef.current = saveStory;
  }, [saveStory]);

  useTitle(`${pageTitle} - ${STORYTELLER_APP_NAME}`, {
    path:
      id && storyId
        ? steamloomPath(
            `my/project/${id}/story/${storyId}${isHistoryRoute ? "/diff" : ""}`,
          )
        : "",
    robots: "noindex, nofollow",
  });

  const wordCount = useMemo(() => storyContentWordCount(content), [content]);

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
      setSaveMessage("已關閉自動存檔，記得手動存檔。");
      setSaveMessageSeverity("success");
      setSaveMessageVisible(true);
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
    setSaveMessage(`已設定每 ${minutes} 分鐘自動存檔。`);
    setSaveMessageSeverity("success");
    setSaveMessageVisible(true);
  }

  useEffect(() => {
    if (
      !apiProject?.public_id ||
      isNewStory ||
      !story?.id ||
      !autoSaveEnabled
    ) {
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
        saveStoryRef.current.mutate(
          {
            storyPublicId: story.id,
            input: {
              title: latestDraft.title,
              summary: latestDraft.summary,
              status: latestDraft.status,
              sort: latestDraft.sort,
              content: latestDraft.content,
              parent_id: latestDraft.parentPublicId,
              save_trigger: "auto",
              base_version_id: latestVersionIdRef.current,
            },
          },
          {
            onSuccess: (savedStory) => {
              lastSavedDraftRef.current = currentDraft;
              setSaveMessage("已自動存檔。");
              setSaveMessageSeverity("success");
              setSaveMessageVisible(true);
              if (savedStory?.version_conflict) {
                setVersionConflict(true);
              }
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
  }, [apiProject?.public_id, isNewStory, story?.id, autoSaveEnabled]);

  const storyShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: "我的工作台", to: steamloomPath("my") },
    { label: "創作專案", to: steamloomPath("my/projects") },
  ];

  function renderEditorFrame({
    title,
    breadcrumbs,
    action,
    headerContent,
    children,
  }: {
    title: string;
    breadcrumbs: Array<{ label: string; to?: string }>;
    action?: ReactNode;
    headerContent?: ReactNode;
    children: ReactNode;
  }) {
    if (embedded) {
      return (
        <Stack spacing={2.5} sx={{ pb: 4 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="h4" fontWeight={800} color="primary.main">
              {title}
            </Typography>
            {action}
          </Stack>
          {headerContent}
          <Box>{children}</Box>
        </Stack>
      );
    }
    return (
      <StorytellerShell
        title={title}
        breadcrumbs={breadcrumbs}
        action={action}
        hideHeading
        headerContent={headerContent}
      >
        {children}
      </StorytellerShell>
    );
  }

  // Ctrl/Cmd+S 手動存檔快捷鍵——工具列拔除後，存檔按鈕只在文件層級 action 區，
  // 長篇寫作時要存檔得把頁面捲回最上面，Phase 9.5 人工測試反映這個麻煩，尤其
  // 行動版更明顯。用 ref 存最新的 handleSaveStory／pending 狀態，避免每次
  // render 都要重新掛一次 listener。
  //
  // 已知 Bug 記錄：這段 hook 原本寫在 `if (authLoading)`／`if (!session)` 等
  // early return 之後（`handleSaveStory` 定義的旁邊），導致未登入／載入中的
  // render 完全不會呼叫這三個 hook，登入後的 render 才會呼叫，違反 Rules of
  // Hooks（"Rendered more hooks than during the previous render"）。
  // `handleSaveStory` 是 function 宣告會整個 hoist，所以搬到所有 early return
  // 之前一樣讀得到，不需要跟著搬。
  const handleSaveStoryRef = useRef(handleSaveStory);
  const isSavingRef = useRef(saveStory.isPending);
  useEffect(() => {
    handleSaveStoryRef.current = handleSaveStory;
    isSavingRef.current = saveStory.isPending;
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
      if (isSavingRef.current) return;
      handleSaveStoryRef.current();
    }
    window.addEventListener("keydown", handleSaveHotkey);
    return () => window.removeEventListener("keydown", handleSaveHotkey);
  }, []);

  if (authLoading) {
    return renderEditorFrame({
      title: "故事編輯器",
      breadcrumbs: storyShellBreadcrumbs,
      children: (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      ),
    });
  }

  if (!session) {
    return renderEditorFrame({
      title: "故事編輯器",
      breadcrumbs: storyShellBreadcrumbs,
      children: (
        <CustomLoginRequiredState
          description="登入後即可編輯這篇故事。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      ),
    });
  }

  if (
    (!project && (apiProjectsPending || apiProjectsFetching)) ||
    (apiProject &&
      !isNewStory &&
      !story &&
      (apiStoriesPending || apiStoriesFetching))
  ) {
    return renderEditorFrame({
      title: "故事編輯器",
      breadcrumbs: storyShellBreadcrumbs,
      children: <StorytellerLoading label="正在載入故事編輯資料..." />,
    });
  }

  if (!project || (!isNewStory && !story)) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={
          embedded
            ? steamloomPath(
                defaultVolumeIdFromQuery
                  ? `my/workspace/${id}/stories/${defaultVolumeIdFromQuery}`
                  : `my/workspace/${id}`,
              )
            : undefined
        }
      />
    );
  }

  function isRightDiffDisabled(diffId: string) {
    const diff = storyDiffs.find((item) => item.id === diffId);
    if (!leftDiff || !diff || diff.id === leftDiff.id) {
      return true;
    }

    return new Date(diff.createdAt) <= new Date(leftDiff.createdAt);
  }

  function handleLeftDiffChange(diffId: string) {
    setLeftDiffId(diffId);
    const selectedLeftDiff = storyDiffs.find((diff) => diff.id === diffId);
    const selectedRightDiff = storyDiffs.find(
      (diff) => diff.id === rightDiffId,
    );

    if (
      !selectedLeftDiff ||
      !selectedRightDiff ||
      selectedRightDiff.id === selectedLeftDiff.id ||
      new Date(selectedRightDiff.createdAt) <=
        new Date(selectedLeftDiff.createdAt)
    ) {
      setRightDiffId("");
    }
  }

  function handleSidePanelChange(value: StorytellerEditorSidePanel | null) {
    setSidePanel(value);

    if (embedded) {
      return;
    }
    if (!id || !storyId || isNewStory) {
      return;
    }

    const editorPath = steamloomPath(`my/project/${id}/story/${storyId}`);
    const historyPath = `${editorPath}/diff`;

    if (value === "history" && location.pathname !== historyPath) {
      navigate(historyPath);
    } else if (value !== "history" && location.pathname === historyPath) {
      navigate(editorPath);
    }
  }

  function handleSelectionAgentTrigger(
    trigger: StorytellerSelectionAgentTrigger,
  ) {
    setPendingSelectionAgentTrigger(trigger);
    handleSidePanelChange("agentic");
  }

  function insertAsset(asset: StorytellerAsset) {
    const inserted = editorRef.current?.insertAsset({
      publicId: asset.public_id,
      src: asset.preview_url,
      alt: asset.alt_text || storytellerAssetTitle(asset),
      projectPublicId: apiProject?.public_id,
    });
    setAssetPickerOpen(false);
    setSaveMessage(
      inserted ? "已插入資產。" : "無法插入資產，請重新整理後再試。",
    );
    setSaveMessageSeverity(inserted ? "success" : "error");
    setSaveMessageVisible(true);
  }

  // 書籤存的是段落的 markerId，只有「已經真的存進後端的內容」才保證下次載入
  // 還在——如果段落是剛打的字、還沒存檔就加書籤，或這篇故事是還沒被 marker id
  // backfill 處理過的舊資料（見 hasUnpersistedMarkerBackfillRef），重新整理
  // 頁面時編輯器會用後端目前存的舊內容重新解析，剛才那個 markerId 根本沒被
  // 存過，書籤就會變成「找不到這個位置了」。加書籤前兩種情況都先存一次，
  // 兩個網路請求誰先送達不重要，只要存檔最後有成功，markerId 就會落地。
  function handleAddBookmarkWithSave(markerId: string, note: string) {
    if (hasUnsavedStoryChanges() || hasUnpersistedMarkerBackfillRef.current) {
      handleSaveStory();
      hasUnpersistedMarkerBackfillRef.current = false;
    }
    outline.addBookmark(markerId, note);
  }

  function handleSaveStory() {
    if (!apiProject?.public_id) {
      lastSavedDraftRef.current = currentDraftRef.current;
      setSaveMessage("目前使用前端假資料，未送出到後端 API。");
      setSaveMessageSeverity("info");
      setSaveMessageVisible(true);
      return;
    }

    saveStory.mutate(
      {
        storyPublicId: isNewStory ? undefined : story?.id,
        input: {
          title: storyTitle,
          summary: storySummary,
          status: storyStatus,
          sort: story?.sort ?? 0,
          content,
          parent_id: selectedVolumeId,
          save_trigger: "manual",
          base_version_id: isNewStory ? undefined : latestVersionIdRef.current,
        },
      },
      {
        onSuccess: (savedStory) => {
          lastSavedDraftRef.current = currentDraftRef.current;
          setSaveMessage("故事已存檔。");
          setSaveMessageSeverity("success");
          setSaveMessageVisible(true);
          if (isNewStory && savedStory?.public_id) {
            // embedded（工作台）模式下要留在工作台右欄，把網址從 .../story/new
            // 換成存好之後的真正 public_id，不能整個跳回舊版獨立編輯頁——不然
            // 剛剛才做的「新建也在右欄出血顯示」等於白做。
            navigate(
              steamloomPath(
                embedded
                  ? `my/workspace/${id}/story/${savedStory.public_id}`
                  : `my/project/${id}/story/${savedStory.public_id}`,
              ),
            );
          }
          if (savedStory?.version_conflict) {
            setVersionConflict(true);
          }
        },
      },
    );
  }

  // AI 助理提案卡片「套用提案」在提案目標剛好是目前這篇故事時走這條路：把提案
  // 帶的欄位填進編輯區、立刻用一般存檔 API 存一次（save_trigger 特別標成
  // agent_apply，編輯歷史看得出這個版本是套用 AI 提案存的，不是使用者手動存
  // 的），失敗時整個 reject，讓呼叫端（StorytellerAgenticProposalCard）知道不
  // 能把提案標成已套用。沒帶到的欄位（例如 AI 只改了內容、沒動標題）維持目前
  // 畫面上的值不動，不會被清空。
  async function applyAgenticProposalToEditor(
    proposal: StorytellerAgenticProposal,
  ) {
    const args = proposal.arguments;
    const nextTitle = typeof args.title === "string" ? args.title : storyTitle;
    const nextSummary =
      typeof args.summary === "string" ? args.summary : storySummary;
    const nextStatus =
      args.status === "draft" || args.status === "completed"
        ? args.status
        : storyStatus;
    // 段落 markerId 不用在這裡處理——後端存檔時統一補齊（見
    // backfillStoryMarkerIds），這裡送什麼內容過去都不用擔心。
    const nextContent =
      typeof args.content === "string" ? args.content : content;
    const nextVolumeId =
      typeof args.volume_public_id === "string" &&
      (args.volume_public_id === "" ||
        looksLikeStorytellerPublicId(args.volume_public_id))
        ? args.volume_public_id
        : selectedVolumeId;

    setStoryTitle(nextTitle);
    setStorySummary(nextSummary);
    setStoryStatus(nextStatus);
    setContent(nextContent);
    setSelectedVolumeId(nextVolumeId);

    if (!apiProject?.public_id || isNewStory) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      saveStory.mutate(
        {
          storyPublicId: story?.id,
          input: {
            title: nextTitle,
            summary: nextSummary,
            status: nextStatus,
            sort: story?.sort ?? 0,
            content: nextContent,
            parent_id: nextVolumeId,
            save_trigger: "agent_apply",
            base_version_id: latestVersionIdRef.current,
          },
        },
        {
          onSuccess: (savedStory) => {
            // 後端存檔時會補齊段落 markerId（見 backfillStoryMarkerIds），實際存進
            // DB 的內容跟這裡送出去的 nextContent 不會逐字一樣——改用回應帶回來的
            // latest_content 同步編輯區，不然編輯區顯示的 markerId 會跟資料庫裡的
            // 對不上（各自隨機產生），書籤等功能定位會失準。
            const savedContent = savedStory?.latest_content ?? nextContent;
            setContent(savedContent);
            const savedDraft = serializeStoryDraft(
              nextTitle,
              nextSummary,
              nextStatus,
              nextVolumeId,
              savedContent,
            );
            currentDraftRef.current = savedDraft;
            lastSavedDraftRef.current = savedDraft;
            setSaveMessage("已套用 AI 提案並存檔。");
            setSaveMessageSeverity("success");
            setSaveMessageVisible(true);
            if (savedStory?.version_conflict) {
              setVersionConflict(true);
            }
            resolve();
          },
          onError: (err) =>
            reject(new Error(errorMessage(err, "套用 AI 提案存檔失敗。"))),
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
      onCopy: () => {
        setSaveMessage("AI 回應已複製。");
        setSaveMessageSeverity("success");
        setSaveMessageVisible(true);
      },
      onSelectionMismatch: () => {
        setSaveMessage("選取範圍已變更，請改用插入或複製。");
        setSaveMessageSeverity("error");
        setSaveMessageVisible(true);
      },
      onAfterApply: () => {},
    });
  }

  const statusOptions = [
    {
      value: "draft",
      label: "未公開",
      icon: <VisibilityOffIcon fontSize="small" />,
    },
    {
      value: "completed",
      label: "公開中",
      icon: <VisibilityIcon fontSize="small" />,
    },
  ];
  const volumeOptions = [
    { value: "", label: "不分冊", icon: <FolderIcon fontSize="small" /> },
    ...apiVolumes.map((volume) => ({
      value: volume.public_id,
      label: volume.title,
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
  // embedded 寫作頁則下放到 StoryWritingWorkspace 的底部狀態列，避免長標題被擠壓。
  const storyEditorActionContent = (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      <Chip label={`${wordCount.toLocaleString()} 字`} />
      {!embedded && (
        <Chip
          label={storyStatus === "completed" ? "公開中" : "未公開"}
          color={storyStatus === "completed" ? "success" : "warning"}
          variant="outlined"
        />
      )}
      {story ? (
        <>
          <Chip label={`更新於 ${formatStorytellerDate(story.updatedAt)}`} />
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
  const storyEditorBottomStatusContent = embedded ? (
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
      {storyEditorActionContent}
    </Stack>
  ) : undefined;
  const storyEditorBottomActionContent = embedded ? (
    // disabled 的原生 button 不會觸發滑鼠事件，Tooltip 需要包一層 span
    // 才能在按鈕 disabled 時（存檔中）依然收得到 hover 事件顯示提示。
    <Tooltip title="快捷鍵：Ctrl+S／⌘S">
      <span>
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saveStory.isPending}
          onClick={handleSaveStory}
          sx={{ minWidth: 88 }}
        >
          {saveStory.isPending ? "存檔中" : "存檔"}
        </Button>
      </span>
    </Tooltip>
  ) : undefined;
  const storyEditorHeaderContent = embedded ? (
    <Box
      sx={{
        // Faryne 反映編輯器畫面捲下去後，標題／摘要／存檔按鈕全部一起被捲走，
        // 要往上滑才看得到——改成 sticky 釘在工作台右欄面板頂部（真正的捲動
        // 容器是 ProjectWorkspacePreview.tsx 那層 overflow:auto 的 Box，不是
        // 這裡），這樣捲動編輯器內文時這幾個常用控制項會一直留在畫面上。
        // 背景色跟工作台右欄面板背景（ProjectWorkspacePreview.tsx 的 grid
        // bgcolor）用同一個條件式，不然捲動時底下內容會透出來蓋住文字。
        position: "sticky",
        top: 0,
        zIndex: 2,
        pb: 1,
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#191919" : "#ffffff",
      }}
    >
      <Box
        sx={{
          width: 1,
        }}
      >
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
                    handleSidePanelChange("history");
                    setVersionConflict(false);
                  }}
                >
                  查看編輯歷史
                </Button>
              }
            >
              剛剛存檔完成後才發現這篇故事在中途被更新過，已經接在最新版本後面存成新版了。
            </Alert>
          ) : (
            saveStory.isError && (
              <Alert severity="error" variant="outlined">
                存檔失敗，請確認登入狀態與欄位內容。
              </Alert>
            )
          )}
          <WorkspaceEditorHeaderRow
            title={
              <WorkspaceEditableTitle
                value={storyTitle}
                onChange={setStoryTitle}
                placeholder="未命名故事"
              />
            }
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <WorkspaceEditorSelectButton
              icon={
                storyStatus === "completed" ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )
              }
              label="狀態"
              value={storyStatus}
              options={statusOptions}
              onChange={(value) =>
                setStoryStatus(value as "draft" | "completed")
              }
            />
            <WorkspaceEditorSelectButton
              icon={<FolderIcon fontSize="small" />}
              label="冊"
              value={selectedVolumeId}
              options={volumeOptions}
              onChange={setSelectedVolumeId}
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
          <WorkspaceEditableSummary
            value={storySummary}
            onChange={setStorySummary}
            placeholder="新增摘要..."
          />
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
                handleSidePanelChange("history");
                setVersionConflict(false);
              }}
            >
              查看編輯歷史
            </Button>
          }
        >
          剛剛存檔完成後才發現這篇故事在中途被更新過（可能是另一個分頁，或透過
          MCP
          連上的工具），已經接在最新版本後面存成新版了，方便的話去編輯歷史確認一下有沒有需要注意的地方。
        </Alert>
      ) : (
        saveStory.isError && (
          <Alert severity="error" variant="outlined">
            存檔失敗，請確認登入狀態與欄位內容。
          </Alert>
        )
      )}
      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            required
            fullWidth
            label="故事標題"
            value={storyTitle}
            onChange={(event) => setStoryTitle(event.target.value)}
            placeholder="請輸入故事標題"
            helperText="列表與編輯頁標題以此欄位為主。"
          />
        </Grid>
        {apiProject && (
          <Grid size={{ xs: 12, md: 4 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
          {/* Button 有 fullWidth，包裹用的 span 要是 block 才不會把寬度收縮
              回內容寬度（inline span 預設不會撐滿）。 */}
          <Tooltip title="快捷鍵：Ctrl+S／⌘S">
            <span style={{ display: "block" }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SaveIcon />}
                sx={{ py: 1.7 }}
                disabled={saveStory.isPending}
                onClick={handleSaveStory}
              >
                {saveStory.isPending ? "存檔中" : "存檔"}
              </Button>
            </span>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            select
            label="故事狀態"
            value={storyStatus}
            onChange={(event) =>
              setStoryStatus(event.target.value as "draft" | "completed")
            }
            helperText="未公開的故事不會出現在公開閱讀頁與故事索引。"
          >
            <MenuItem value="draft">未公開</MenuItem>
            <MenuItem value="completed">公開中</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            select
            label="冊"
            value={selectedVolumeId}
            onChange={(event) => setSelectedVolumeId(event.target.value)}
            helperText="未選擇時視為不分冊。"
          >
            <MenuItem value="">不分冊</MenuItem>
            {apiVolumes.map((volume) => (
              <MenuItem key={volume.public_id} value={volume.public_id}>
                {volume.title}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={12}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={12}
            label="故事摘要"
            value={storySummary}
            onChange={(event) => setStorySummary(event.target.value)}
            placeholder="簡短描述這篇故事的重點、章節目的或目前狀態。"
          />
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
                label: "故事",
                to: steamloomPath(`my/project/${project.id}/stories`),
              },
              { label: pageTitle },
            ]
      }
      action={embedded ? undefined : storyEditorActionContent}
      hideHeading
      plain={embedded}
      fitHeight={embedded}
      headerContent={storyEditorHeaderContent}
    >
      <CustomSnackbar
        open={saveMessageVisible}
        message={saveMessage}
        severity={saveMessageSeverity}
        onClose={() => setSaveMessageVisible(false)}
      />

      <StoryWritingWorkspace
        editor={
          <StorytellerWysiwygEditor
            ref={editorRef}
            value={content}
            onChange={handleEditorContentChange}
            toolbarPlacement={embedded ? "bottom" : "top"}
            fitParentHeight={embedded}
            bottomStatusContent={storyEditorBottomStatusContent}
            bottomActionContent={storyEditorBottomActionContent}
            exportBaseName={storyTitle}
            projectPublicId={apiProject?.public_id}
            hasSavedTarget={Boolean(apiStory?.public_id)}
            onSelectionAgentTrigger={handleSelectionAgentTrigger}
            onRequestInsertAsset={
              apiProject ? () => setAssetPickerOpen(true) : undefined
            }
            bookmarkedMarkerIds={outline.bookmarkedMarkerIds}
            canBookmark={outline.canBookmark}
            onAddBookmark={handleAddBookmarkWithSave}
            onRemoveBookmark={outline.removeBookmark}
            onEditorReady={outline.onEditorReady}
            toolbarExtra={
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="插入資產">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!apiProject}
                      onClick={() => setAssetPickerOpen(true)}
                      aria-label="插入資產"
                    >
                      <ImageIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <StorytellerEditorOutlineToggle
                  open={outline.outlineOpen}
                  onToggle={outline.setOutlineOpen}
                >
                  <StorytellerEditorOutlinePanel
                    editor={outline.editor}
                    bookmarks={outline.bookmarks}
                    loading={outline.bookmarksLoading}
                    onDeleteBookmark={outline.removeBookmark}
                    onUpdateBookmarkNote={outline.saveBookmarkNote}
                  />
                </StorytellerEditorOutlineToggle>
                <StorytellerEditorSideTabs
                  value={sidePanel}
                  onChange={handleSidePanelChange}
                  aiTabHidden
                />
              </Stack>
            }
          />
        }
        dock={
          sidePanel && (
            <>
              {sidePanel === "history" && (
                <StoryEditorHistoryPanel
                  items={visibleStoryDiffs}
                  allItems={storyDiffs}
                  loading={apiStoryVersionsLoading}
                  leftVersionId={leftDiffId}
                  rightVersionId={rightDiffId}
                  onCompare={() => setCompareDialogOpen(true)}
                  onLeftVersionChange={handleLeftDiffChange}
                  onRightVersionChange={setRightDiffId}
                  isRightVersionDisabled={isRightDiffDisabled}
                  isNewStory={isNewStory}
                  page={historyPage}
                  pageCount={totalHistoryPages}
                  onPageChange={setHistoryPage}
                  currentVersionId={
                    apiStoryVersions[0]?.id !== undefined
                      ? String(apiStoryVersions[0].id)
                      : undefined
                  }
                  revertingVersionId={
                    revertStoryVersion.isPending
                      ? String(revertStoryVersion.variables)
                      : null
                  }
                  onRevert={(versionId) => {
                    revertStoryVersion.mutate(Number(versionId), {
                      onSuccess: () => {
                        setVersionConflict(false);
                        setSaveMessage("已回復到這個版本。");
                        setSaveMessageSeverity("success");
                        setSaveMessageVisible(true);
                      },
                    });
                  }}
                />
              )}

              {sidePanel === "agentic" && (
                <StorytellerAgenticPanel
                  targetKind="story"
                  presentation="floatingDock"
                  projectPublicId={apiProject?.public_id}
                  targetPublicId={apiStory?.public_id}
                  agents={panelAgents}
                  currentStory={{
                    title: storyTitle,
                    summary: storySummary,
                    content,
                    versionId: apiStory?.latest_version_id ?? null,
                    updatedAt: apiStory?.updated_at ?? new Date().toISOString(),
                  }}
                  otherStories={agenticOtherStories}
                  lores={agenticLores}
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
      <StorytellerAssetPickerDialog
        open={assetPickerOpen}
        projectPublicId={apiProject?.public_id}
        title="插入故事資產"
        onClose={() => setAssetPickerOpen(false)}
        onSelect={insertAsset}
      />
      <StorytellerVersionCompareDialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        itemTitle={storyTitle.trim() || story?.title || "未命名故事"}
        leftVersion={
          leftCompareVersion
            ? {
                title: leftCompareVersion.title,
                summary: leftCompareVersion.summary,
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
                summary: rightCompareVersion.summary,
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
