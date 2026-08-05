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
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useRevertStorytellerStoryVersion,
  useRunStorytellerAgent,
  useSaveStorytellerStory,
  useStorytellerAgents,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerProviderAPIKeys,
  useStorytellerStoryChatMessages,
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
import {
  StoryEditHistory,
  type StoryEditHistoryItem,
} from "@/pages/storyteller/StoryEditHistory.tsx";
import {
  StorytellerAgentPanel,
  type StorytellerAgentPanelAgent,
  type StorytellerAgentPanelMessage,
} from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import {
  StorytellerEditorSideTabs,
  type StorytellerEditorSidePanel,
} from "@/pages/storyteller/StorytellerEditorSideTabs.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import { StorytellerVersionCompareDialog } from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSelectButton,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { storytellerAssetTitle } from "@/pages/storyteller/storytellerAssetMarkdown.ts";
import {
  buildStorytellerAgentReferenceContent,
  buildStorytellerAgentReplyQuote,
  buildStorytellerAgentReplyReferenceContent,
  composeStorytellerAgentInstructionWithReply,
  resolveStorytellerAgentReferences,
} from "@/pages/storyteller/storytellerAgentReferences.ts";
import {
  applyStorytellerAgentText,
  currentLoreMentionQuery,
  currentStoryMentionQuery,
  insertLoreMention,
  insertStoryMention,
  type StorytellerAgentTextSelection,
} from "@/pages/storyteller/storytellerAgentEditing.ts";
import {
  StorytellerWysiwygEditor,
  type StorytellerWysiwygEditorHandle,
} from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygCore/parser.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunResponse,
  StorytellerAsset,
  StorytellerStoryChatMessage,
} from "@/types/storyteller.ts";

const historyPerPage = 5;
const autoSaveIntervalMinutesMin = 2;
const autoSaveIntervalMinutesMax = 60;
const autoSaveIntervalMinutesDefault = 5;
const autoSavePresetMinutes = [2, 5, 10];
const aiMessagesPerPage = 10;
const aiInstructionMaxCharacters = 4000;
const aiFullContentMaxCharacters = 60000;
const aiTotalPayloadMaxCharacters = 80000;

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

interface OptimisticChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent_id: number;
  agent_name: string;
  mode?: StorytellerAgentRunMode;
  usage?: StorytellerAgentRunResponse["usage"];
  resultSelection?: StorytellerAgentTextSelection | null;
  isLoading?: boolean;
  isCurrentResult?: boolean;
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
      ? apiAgents
          .filter((agent) => agent.provider_apikey_id !== null)
          .map((agent) => ({
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
  const runAgent = useRunStorytellerAgent(
    apiProject?.public_id,
    apiStory?.public_id,
  );
  const { data: apiStoryVersions = [], isLoading: apiStoryVersionsLoading } =
    useStorytellerStoryVersions(apiProject?.public_id, apiStory?.public_id);
  const {
    data: aiMessagesPages,
    isLoading: aiMessagesLoading,
    hasNextPage: hasMoreAiMessages,
    isFetchingNextPage: loadingMoreAiMessages,
    fetchNextPage: fetchMoreAiMessages,
  } = useStorytellerStoryChatMessages(
    apiProject?.public_id,
    apiStory?.public_id,
    aiMessagesPerPage,
  );
  const [storyTitle, setStoryTitle] = useState(story?.title ?? "");
  const [storySummary, setStorySummary] = useState(story?.summary ?? "");
  const [storyStatus, setStoryStatus] = useState<"draft" | "completed">(
    story?.status ?? "completed",
  );
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel | null>(
    isHistoryRoute ? "history" : null,
  );
  const [content, setContent] = useState(story?.content ?? "");
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const editorRef = useRef<StorytellerWysiwygEditorHandle>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [replyTarget, setReplyTarget] =
    useState<StorytellerAgentPanelMessage | null>(null);
  const [aiResult, setAiResult] = useState<StorytellerAgentRunResponse | null>(
    null,
  );
  const [aiResultSelection, setAiResultSelection] =
    useState<StorytellerAgentTextSelection | null>(null);
  const [optimisticMessage, setOptimisticMessage] =
    useState<OptimisticChatMessage | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(
    agentRows[0]?.id ?? "",
  );
  const { data: providerApiKeys = [] } = useStorytellerProviderAPIKeys();
  const [overrideApiKeyId, setOverrideApiKeyId] = useState("");
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
  const pendingMessageIdRef = useRef(0);
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
  const selectedAgent =
    agentRows.find((agent) => agent.id === selectedAgentId) ?? agentRows[0];
  const selectedAgentNumericId = Number(selectedAgent?.id);
  const overrideApiKeyOptions = providerApiKeys.filter(
    (apiKey) => apiKey.provider === selectedAgent?.provider,
  );
  // 第 1 頁是最新訊息，載入更早的訊息時往後翻頁；顯示時要反過來，最早的頁在最上面
  const aiMessages = (aiMessagesPages?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.items);
  const visibleAiMessages = aiResult
    ? aiMessages.filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.agent_id === aiResult.agent_id &&
            message.content.trim() === aiResult.result.trim()
          ),
      )
    : aiMessages;
  const transientMessages: OptimisticChatMessage[] = [];
  if (optimisticMessage) {
    transientMessages.push(optimisticMessage);
  }
  if (aiResult) {
    transientMessages.push({
      id: `agent-result-${aiResult.agent_id}-${aiResult.result.length}`,
      role: "assistant",
      content: aiResult.result,
      agent_id: aiResult.agent_id,
      agent_name: selectedAgent?.name ?? "AI Agent",
      mode: aiResult.mode,
      usage: aiResult.usage,
      resultSelection: aiResultSelection,
      isCurrentResult: true,
    });
  }
  const agentPromptReferences = resolveStorytellerAgentReferences({
    prompt: aiPrompt,
    currentStory: apiStory
      ? {
          kind: "story",
          id: apiStory.public_id,
          title: storyTitle.trim() || apiStory.title,
          content,
        }
      : null,
    stories: apiStories
      .filter((item) => item.public_id !== apiStory?.public_id)
      .map((item) => ({
        kind: "story" as const,
        id: item.public_id,
        title: item.title,
        content: item.latest_content,
      })),
    lores: apiLores.map((item) => ({
      kind: "lore" as const,
      id: item.public_id,
      title: item.title,
      content: item.latest_content,
    })),
  });
  const replyReferenceTarget = replyTarget
    ? {
        id: replyTarget.id,
        speaker: replyTarget.speaker,
        content: replyTarget.content,
      }
    : null;
  const agentReferenceContent = [
    buildStorytellerAgentReferenceContent(agentPromptReferences),
    buildStorytellerAgentReplyReferenceContent(replyReferenceTarget),
  ]
    .filter(Boolean)
    .join("\n\n");
  const replyQuote = buildStorytellerAgentReplyQuote(replyReferenceTarget);
  const aiPromptLength = Array.from(aiPrompt).length;
  const aiInstructionPayloadLength =
    aiPromptLength + (replyQuote ? Array.from(`${replyQuote}\n\n`).length : 0);
  const aiReferenceContentLength = Array.from(agentReferenceContent).length;
  const aiPayloadLength = aiInstructionPayloadLength + aiReferenceContentLength;
  const aiPayloadError =
    aiInstructionPayloadLength > aiInstructionMaxCharacters
      ? `輸入需求最多 ${aiInstructionMaxCharacters.toLocaleString()} 字。`
      : aiReferenceContentLength > aiFullContentMaxCharacters
        ? `引用內容最多 ${aiFullContentMaxCharacters.toLocaleString()} 字。`
        : aiPayloadLength > aiTotalPayloadMaxCharacters
          ? `單次 Agent payload 最多 ${aiTotalPayloadMaxCharacters.toLocaleString()} 字。`
          : "";
  const chatMessages: StorytellerAgentPanelMessage[] = [
    ...visibleAiMessages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
      speaker: messageSpeaker(message),
    })),
    ...transientMessages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
      speaker: messageSpeaker(message),
      mode: message.mode,
      usage: message.usage,
      resultSelection: message.resultSelection,
      isLoading: message.isLoading,
      isCurrentResult: message.isCurrentResult,
    })),
  ];
  const panelAgents: StorytellerAgentPanelAgent[] = agentRows.map((agent) => ({
    id: agent.id,
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    prompt: agent.purpose,
    enabled: agent.enabled,
  }));
  const storyMentionQuery = currentStoryMentionQuery(aiPrompt);
  const loreMentionQuery = currentLoreMentionQuery(aiPrompt);
  const storyMentionOptions =
    storyMentionQuery === null
      ? []
      : apiStories
          .filter((item) => item.public_id !== apiStory?.public_id)
          .filter((item) =>
            item.title.toLowerCase().includes(storyMentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const loreMentionOptions =
    loreMentionQuery === null
      ? []
      : apiLores
          .filter((item) =>
            item.title.toLowerCase().includes(loreMentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const canRunAgent =
    Boolean(apiProject?.public_id && apiStory?.public_id) &&
    Number.isFinite(selectedAgentNumericId) &&
    Boolean(selectedAgent?.enabled) &&
    aiPayloadError === "" &&
    !runAgent.isPending;

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
    setStoryStatus(story?.status ?? "completed");
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
      story?.status ?? "completed",
      parentVolume?.public_id ?? "",
      story?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
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

  useEffect(() => {
    saveStoryRef.current = saveStory;
  }, [saveStory]);

  useEffect(() => {
    if (!agentRows.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agentRows[0]?.id ?? "");
    }
  }, [agentRows, selectedAgentId]);

  // 換 Agent 後，之前選的覆寫金鑰不一定屬於新 Agent 的供應商，重置回「使用預設」
  useEffect(() => {
    setOverrideApiKeyId("");
  }, [selectedAgentId]);

  useTitle(`${pageTitle} - ${STORYTELLER_APP_NAME}`, {
    path:
      id && storyId
        ? steamloomPath(
            `my/project/${id}/story/${storyId}${isHistoryRoute ? "/diff" : ""}`,
          )
        : "",
    robots: "noindex, nofollow",
  });

  // 字數只算段落實際文字，不含 marker id／comment 屬性／標題與對齊語法的符號，
  // 不然新編輯器產生的內容會讓字數被這些不算「故事內容」的字元灌水。
  const wordCount = useMemo(() => {
    const cleanText = parseMarkdownToParagraphs(content)
      .flatMap((paragraph) => paragraph.runs)
      .map((run) => run.text)
      .join("");
    return cleanText.replace(/\s+/g, "").length;
  }, [content]);

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
    { label: "創作專案", to: steamloomPath("my/project") },
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
    setSaveMessageVisible(true);
  }

  function handleSaveStory() {
    if (!apiProject?.public_id) {
      lastSavedDraftRef.current = currentDraftRef.current;
      setSaveMessage("目前使用前端假資料，未送出到後端 API。");
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

  function runSelectedAgent(
    mode?: StorytellerAgentRunMode,
    instructionOverride?: string,
  ) {
    const rawInstruction = instructionOverride ?? aiPrompt;
    const trimmedInstruction = instructionOverride
      ? instructionOverride
      : normalizeInstructionForRun(rawInstruction);
    const instruction = composeStorytellerAgentInstructionWithReply(
      trimmedInstruction,
      replyReferenceTarget,
    );
    if (!canRunAgent) {
      return;
    }
    // 「取代選取範圍」這次先停用（見 StorytellerAgentPanel 的 enableReplace/enableInsert），
    // 所以這裡不需要再追蹤 textarea 的選取範圍，固定傳 null。
    const resultSelection = null;
    const nextMode = mode ?? "custom_chapter";
    pendingMessageIdRef.current += 1;
    setOptimisticMessage({
      id: `pending-${pendingMessageIdRef.current}`,
      role: "user",
      content: instruction.trim() || "（未輸入需求）",
      agent_id: selectedAgentNumericId,
      agent_name: selectedAgent?.name ?? "AI Agent",
    });
    setAiPrompt("");
    setReplyTarget(null);

    runAgent.mutate(
      {
        agentId: selectedAgentNumericId,
        input: {
          mode: nextMode,
          instruction,
          full_content: agentReferenceContent,
          selected_content: "",
          provider_apikey_id: overrideApiKeyId
            ? Number(overrideApiKeyId)
            : undefined,
        },
      },
      {
        onSuccess: (result) => {
          setAiResult(result ?? null);
          setAiResultSelection(resultSelection);
        },
        onSettled: () => {
          setOptimisticMessage(null);
        },
      },
    );
  }

  function normalizeInstructionForRun(value: string) {
    return value.trim();
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
        setSaveMessageVisible(true);
      },
      onSelectionMismatch: () => {
        setSaveMessage("選取範圍已變更，請改用插入或複製。");
        setSaveMessageVisible(true);
      },
      onAfterApply: () => {},
    });
  }

  function aiErrorMessage(error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "data" in error.response
    ) {
      const data = error.response.data as { message?: string };
      if (data.message) {
        return data.message;
      }
    }
    return "AI Agent 呼叫失敗，請確認 Agent 設定與後端狀態。";
  }

  function messageSpeaker(
    message: StorytellerStoryChatMessage | OptimisticChatMessage,
  ) {
    if (message.role === "assistant") {
      return message.agent_name || selectedAgent?.name || "AI Agent";
    }
    if (message.role === "user") {
      return userProfile?.pen_name || "使用者";
    }
    return "System";
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
  // 字數／更新時間／自動存檔狀態的 chip 列，加上存檔按鈕——embedded 模式下要跟
  // 標題排在同一列（見下面 WorkspaceEditorHeaderRow），非 embedded 模式則維持
  // 原本透過 StorytellerShell 的 action 插槽顯示。
  const storyEditorActionContent = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
      {embedded && (
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saveStory.isPending}
          onClick={handleSaveStory}
        >
          {saveStory.isPending ? "存檔中" : "存檔"}
        </Button>
      )}
    </Stack>
  );
  const storyEditorHeaderContent = embedded ? (
    <Stack spacing={2.25}>
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
        actions={storyEditorActionContent}
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
          onChange={(value) => setStoryStatus(value as "draft" | "completed")}
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
              { label: "創作專案", to: steamloomPath("my/project") },
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
      headerContent={storyEditorHeaderContent}
    >
      <CustomSnackbar
        open={saveMessageVisible}
        message={saveMessage}
        severity={apiProject ? "success" : "info"}
        onClose={() => setSaveMessageVisible(false)}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: sidePanel ? 7 : 12 }}>
          <StorytellerWysiwygEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            exportBaseName={storyTitle}
            projectPublicId={apiProject?.public_id}
            toolbarExtra={
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="插入資產">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!apiProject}
                      onClick={() => setAssetPickerOpen(true)}
                    >
                      <ImageIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <StorytellerEditorSideTabs
                  value={sidePanel}
                  onChange={handleSidePanelChange}
                />
              </Stack>
            }
          />
        </Grid>

        {sidePanel && (
          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={2}>
              {sidePanel === "history" && (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 1,
                    p: 2,
                    height: { lg: 720 },
                    overflow: "auto",
                  }}
                >
                  <StoryEditHistory
                    items={visibleStoryDiffs}
                    allItems={storyDiffs}
                    loading={apiStoryVersionsLoading}
                    leftVersionId={leftDiffId}
                    rightVersionId={rightDiffId}
                    onCompare={() => setCompareDialogOpen(true)}
                    onLeftVersionChange={handleLeftDiffChange}
                    onRightVersionChange={setRightDiffId}
                    isRightVersionDisabled={isRightDiffDisabled}
                    isNewItem={isNewStory}
                    newItemMessage="新故事第一次存檔後才會產生編輯歷史。"
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
                          setSaveMessageVisible(true);
                        },
                      });
                    }}
                  />
                </Paper>
              )}

              {sidePanel === "ai" && (
                <StorytellerAgentPanel
                  agents={panelAgents}
                  selectedAgentId={selectedAgentId}
                  onSelectedAgentChange={setSelectedAgentId}
                  messages={chatMessages}
                  messagesLoading={aiMessagesLoading}
                  pending={runAgent.isPending}
                  unavailableMessage={
                    !apiStory?.public_id
                      ? "新故事第一次存檔後才能呼叫 AI Agent。"
                      : undefined
                  }
                  emptyTitle="還沒有 AI Agent 對話紀錄"
                  emptyDescription="送出需求後，這個故事的 AI Agent 對話會顯示在這裡。"
                  hasMoreHistory={Boolean(hasMoreAiMessages)}
                  loadingMoreHistory={loadingMoreAiMessages}
                  onLoadMoreHistory={() => void fetchMoreAiMessages()}
                  errorMessage={
                    runAgent.isError ? aiErrorMessage(runAgent.error) : ""
                  }
                  prompt={aiPrompt}
                  onPromptChange={setAiPrompt}
                  promptPlaceholder="可輸入 Markdown。使用 @thisStory 引用本篇故事，或輸入 @story:、@lore: 從候選清單插入引用。"
                  promptError={Boolean(aiPayloadError)}
                  promptHelperText={`${aiPromptLength.toLocaleString()} / ${aiInstructionMaxCharacters.toLocaleString()} 字`}
                  promptWarning={aiPayloadError}
                  promptExtras={
                    <>
                      {overrideApiKeyOptions.length > 1 && (
                        <TextField
                          select
                          size="small"
                          label="使用其他金鑰執行一次"
                          value={overrideApiKeyId}
                          onChange={(event) =>
                            setOverrideApiKeyId(event.target.value)
                          }
                          sx={{ minWidth: 220 }}
                        >
                          <MenuItem value="">使用 Agent 預設金鑰</MenuItem>
                          {overrideApiKeyOptions.map((apiKey) => (
                            <MenuItem key={apiKey.id} value={String(apiKey.id)}>
                              {apiKey.label || `金鑰 #${apiKey.id}`}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                      {agentPromptReferences.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {agentPromptReferences.map((reference) => (
                            <Chip
                              key={reference.token}
                              size="small"
                              color={
                                reference.token === "@thisStory"
                                  ? "primary"
                                  : "default"
                              }
                              label={reference.title}
                            />
                          ))}
                        </Stack>
                      )}
                      {storyMentionOptions.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {storyMentionOptions.map((item) => (
                            <Button
                              key={item.public_id}
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setAiPrompt((current) =>
                                  insertStoryMention(current, item.title),
                                )
                              }
                            >
                              {item.title}
                            </Button>
                          ))}
                        </Stack>
                      )}
                      {loreMentionOptions.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {loreMentionOptions.map((item) => (
                            <Button
                              key={item.public_id}
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setAiPrompt((current) =>
                                  insertLoreMention(current, item.title),
                                )
                              }
                            >
                              設定集：{item.title}
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </>
                  }
                  canRun={canRunAgent}
                  onRun={() => runSelectedAgent()}
                  onApplyText={applyAgentText}
                  enableReplace={false}
                  enableInsert={false}
                  replyTarget={replyTarget}
                  onReply={setReplyTarget}
                  onCancelReply={() => setReplyTarget(null)}
                />
              )}
            </Stack>
          </Grid>
        )}
      </Grid>
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
