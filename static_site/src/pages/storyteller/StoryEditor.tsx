import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
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
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  formatStorytellerDate,
  storytellerAgents,
} from "@/data/storyteller.ts";
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
import { StorytellerWysiwygMarkdown } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import { StoryWysiwygEditor } from "@/pages/storyteller/StoryWysiwygEditor.tsx";
import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygDemo/parser.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunResponse,
  StorytellerStoryChatMessage,
} from "@/types/storyteller.ts";

const historyPerPage = 5;
const autoSaveIntervalMinutes = 2;
const aiMessagesPerPage = 10;
const aiInstructionMaxCharacters = 4000;
const aiFullContentMaxCharacters = 60000;
const aiTotalPayloadMaxCharacters = 80000;

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
  content: string,
) {
  return JSON.stringify({
    title,
    summary,
    status,
    content,
  });
}

export default function StorytellerStoryEditor() {
  const { id, storyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNewStory = storyId === "new";
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
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel>(
    isHistoryRoute ? "history" : "ai",
  );
  const [content, setContent] = useState(story?.content ?? "");
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
  const [saveMessageVisible, setSaveMessageVisible] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [leftDiffId, setLeftDiffId] = useState("");
  const [rightDiffId, setRightDiffId] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const currentDraftRef = useRef(serializeStoryDraft("", "", "completed", ""));
  const lastSavedDraftRef = useRef(
    serializeStoryDraft("", "", "completed", ""),
  );
  const latestDraftRef = useRef<StoryDraft>({
    title: "",
    summary: "",
    status: "completed",
    content: "",
    sort: 0,
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
        source: "手動編輯",
        createdAt: version.created_at,
        words: version.word_count,
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
  const comparePath =
    id && storyId && leftDiffId && rightDiffId
      ? `/storyteller/my/project/${id}/story/${storyId}/diff/${leftDiffId}/${rightDiffId}`
      : "";
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
    setStoryTitle(story?.title ?? "");
    setStorySummary(story?.summary ?? "");
    setStoryStatus(story?.status ?? "completed");
    setContent(story?.content ?? "");
    const savedDraft = serializeStoryDraft(
      story?.title ?? "",
      story?.summary ?? "",
      story?.status ?? "completed",
      story?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
  }, [story?.content, story?.status, story?.summary, story?.title]);

  useEffect(() => {
    currentDraftRef.current = serializeStoryDraft(
      storyTitle,
      storySummary,
      storyStatus,
      content,
    );
    latestDraftRef.current = {
      title: storyTitle,
      summary: storySummary,
      status: storyStatus,
      content,
      sort: story?.sort ?? 0,
    };
  }, [content, story?.sort, storyStatus, storySummary, storyTitle]);

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

  useTitle(`${pageTitle} - Storyteller`, {
    path:
      id && storyId
        ? `/storyteller/my/project/${id}/story/${storyId}${isHistoryRoute ? "/diff" : ""}`
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

  useEffect(() => {
    if (!apiProject?.public_id || isNewStory || !story?.id) {
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
            },
          },
          {
            onSuccess: () => {
              lastSavedDraftRef.current = currentDraft;
              setSaveMessage("已自動存檔。");
              setSaveMessageVisible(true);
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
  }, [apiProject?.public_id, isNewStory, story?.id]);

  if (
    (!project && (apiProjectsPending || apiProjectsFetching)) ||
    (apiProject &&
      !isNewStory &&
      !story &&
      (apiStoriesPending || apiStoriesFetching))
  ) {
    return (
      <StorytellerShell
        title="故事編輯器"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
        ]}
      >
        <StorytellerLoading label="正在載入故事編輯資料..." />
      </StorytellerShell>
    );
  }

  if (!project || (!isNewStory && !story)) {
    return <ErrorPage code={404} />;
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

  function handleSidePanelChange(value: StorytellerEditorSidePanel) {
    setSidePanel(value);

    if (!id || !storyId || isNewStory) {
      return;
    }

    const editorPath = `/storyteller/my/project/${id}/story/${storyId}`;
    const historyPath = `${editorPath}/diff`;

    if (value === "history" && location.pathname !== historyPath) {
      navigate(historyPath);
    } else if (value !== "history" && location.pathname === historyPath) {
      navigate(editorPath);
    }
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
        },
      },
      {
        onSuccess: (savedStory) => {
          lastSavedDraftRef.current = currentDraftRef.current;
          setSaveMessage("故事已存檔。");
          setSaveMessageVisible(true);
          if (isNewStory && savedStory?.public_id) {
            navigate(
              `/storyteller/my/project/${id}/story/${savedStory.public_id}`,
            );
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

  return (
    <StorytellerShell
      title={pageTitle}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "故事專案", to: "/storyteller/my/project" },
        { label: project.name, to: `/storyteller/my/project/${project.id}` },
        { label: pageTitle },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${wordCount.toLocaleString()} 字`} />
          <Chip
            label={storyStatus === "completed" ? "公開中" : "撰寫中"}
            color={storyStatus === "completed" ? "success" : "warning"}
            variant="outlined"
          />
          {story ? (
            <>
              <Chip
                label={`更新於 ${formatStorytellerDate(story.updatedAt)}`}
              />
              {apiProject && (
                <Chip
                  color="success"
                  variant="outlined"
                  label={`每 ${autoSaveIntervalMinutes} 分鐘自動存檔`}
                />
              )}
            </>
          ) : (
            <Chip label="尚未存檔" color="warning" />
          )}
        </Stack>
      }
      hideHeading
      headerContent={
        <Stack spacing={2}>
          {saveStory.isError && (
            <Alert severity="error" variant="outlined">
              存檔失敗，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 10 }}>
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
            <Grid size={{ xs: 12, md: 2 }}>
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
            <Grid size={12}>
              <TextField
                fullWidth
                select
                label="故事狀態"
                value={storyStatus}
                onChange={(event) =>
                  setStoryStatus(event.target.value as "draft" | "completed")
                }
                helperText="撰寫中的故事不會出現在公開閱讀頁與故事索引。"
              >
                <MenuItem value="draft">撰寫中</MenuItem>
                <MenuItem value="completed">公開中</MenuItem>
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
      }
    >
      <CustomSnackbar
        open={saveMessageVisible}
        message={saveMessage}
        severity={apiProject ? "success" : "info"}
        onClose={() => setSaveMessageVisible(false)}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <StoryWysiwygEditor value={content} onChange={setContent} />
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <StorytellerEditorSideTabs
              value={sidePanel}
              onChange={handleSidePanelChange}
            />
            {sidePanel === "preview" && (
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 1,
                  p: 3,
                  height: { lg: 720 },
                  overflow: "auto",
                }}
              >
                <StorytellerWysiwygMarkdown>
                  {content}
                </StorytellerWysiwygMarkdown>
              </Paper>
            )}

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
                  loading={apiStoryVersionsLoading}
                  leftVersionId={leftDiffId}
                  rightVersionId={rightDiffId}
                  comparePath={comparePath}
                  onLeftVersionChange={handleLeftDiffChange}
                  onRightVersionChange={setRightDiffId}
                  isRightVersionDisabled={isRightDiffDisabled}
                  isNewItem={isNewStory}
                  newItemMessage="新故事第一次存檔後才會產生編輯歷史。"
                  page={historyPage}
                  pageCount={totalHistoryPages}
                  onPageChange={setHistoryPage}
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
      </Grid>
    </StorytellerShell>
  );
}
