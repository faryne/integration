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
import { useNavigate, useParams } from "react-router-dom";
import {
  useRunStorytellerLoreAgent,
  useSaveStorytellerLore,
  useStorytellerAgents,
  useStorytellerLoreChatMessages,
  useStorytellerLoreVersions,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerProviderAPIKeys,
  useStorytellerStories,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import type { AlertColor } from "@mui/material";
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
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { parseMarkdownToParagraphs } from "@/pages/storyteller/wysiwygCore/parser.ts";

const aiMessagesPerPage = 10;
const autoSaveIntervalMinutesMin = 2;
const autoSaveIntervalMinutesMax = 60;
const autoSaveIntervalMinutesDefault = 5;
const autoSavePresetMinutes = [2, 5, 10];
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

interface LoreDraft {
  title: string;
  content: string;
}

function serializeLoreDraft(title: string, content: string) {
  return JSON.stringify({ title, content });
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

export default function StorytellerLoreEditor() {
  const { id, loreId } = useParams();
  const navigate = useNavigate();
  const isNewLore = loreId === "new";
  const currentDraftRef = useRef(serializeLoreDraft("", ""));
  const lastSavedDraftRef = useRef(serializeLoreDraft("", ""));
  const latestDraftRef = useRef<LoreDraft>({ title: "", content: "" });
  const autoSaveRunningRef = useRef(false);
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [replyTarget, setReplyTarget] =
    useState<StorytellerAgentPanelMessage | null>(null);
  // 送出中的需求內容：立刻顯示在對話列表，等後端寫入正式紀錄後清除
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiResultSelection, setAiResultSelection] =
    useState<StorytellerAgentTextSelection | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [overrideApiKeyId, setOverrideApiKeyId] = useState("");
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const [snack, setSnack] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<AlertColor>("success");
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
  const { data: apiStories = [] } = useStorytellerStories(
    apiProject?.public_id,
  );
  const { data: versions = [], isLoading: versionsLoading } =
    useStorytellerLoreVersions(apiProject?.public_id, apiLore?.public_id);
  const { data: allAgents = [] } = useStorytellerAgents();
  const agents = allAgents.filter((agent) => agent.provider_apikey_id !== null);
  const { data: providerApiKeys = [] } = useStorytellerProviderAPIKeys();
  const saveLore = useSaveStorytellerLore(apiProject?.public_id);
  const saveLoreRef = useRef(saveLore);
  const runAgent = useRunStorytellerLoreAgent(
    apiProject?.public_id,
    apiLore?.public_id,
  );
  const {
    data: aiMessagesPages,
    isLoading: aiMessagesLoading,
    hasNextPage: hasMoreAiMessages,
    isFetchingNextPage: loadingMoreAiMessages,
    fetchNextPage: fetchMoreAiMessages,
  } = useStorytellerLoreChatMessages(
    apiProject?.public_id,
    apiLore?.public_id,
    aiMessagesPerPage,
  );

  const project = apiProject
    ? { id: apiProject.public_id, name: apiProject.name }
    : undefined;
  const lore = apiLore
    ? {
        id: apiLore.public_id,
        title: apiLore.title,
        content: apiLore.latest_content,
        updatedAt: apiLore.updated_at,
      }
    : undefined;
  const pageTitle = isNewLore
    ? "建立設定集"
    : title.trim() || lore?.title || "設定集";
  // 字數只算段落實際文字，不含 marker id／comment 屬性／標題與對齊語法的符號，
  // 不然新編輯器產生的內容會讓字數被這些不算「設定集內容」的字元灌水。
  const wordCount = useMemo(() => {
    const cleanText = parseMarkdownToParagraphs(content)
      .flatMap((paragraph) => paragraph.runs)
      .map((run) => run.text)
      .join("");
    return cleanText.replace(/\s+/g, "").length;
  }, [content]);
  const selectedAgent =
    agents.find((agent) => String(agent.id) === selectedAgentId) ?? agents[0];
  const overrideApiKeyOptions = providerApiKeys.filter(
    (apiKey) => apiKey.provider === selectedAgent?.provider,
  );
  const panelAgents: StorytellerAgentPanelAgent[] = agents.map((agent) => ({
    id: String(agent.id),
    name: agent.name,
    provider: agent.provider,
    model: agent.model_name,
    prompt: agent.default_prompt,
    enabled: !agent.is_deleted,
  }));
  const storyMentionQuery = currentStoryMentionQuery(aiPrompt);
  const loreMentionQuery = currentLoreMentionQuery(aiPrompt);
  const storyMentionOptions =
    storyMentionQuery === null
      ? []
      : apiStories
          .filter((item) =>
            item.title.toLowerCase().includes(storyMentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const loreMentionOptions =
    loreMentionQuery === null
      ? []
      : apiLores
          .filter((item) => item.public_id !== apiLore?.public_id)
          .filter((item) =>
            item.title.toLowerCase().includes(loreMentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const loreReferences = resolveStorytellerAgentReferences({
    prompt: aiPrompt,
    currentLore: apiLore
      ? {
          kind: "lore",
          id: apiLore.public_id,
          title: title.trim() || apiLore.title,
          content,
        }
      : null,
    stories: apiStories.map((story) => ({
      kind: "story" as const,
      id: story.public_id,
      title: story.title,
      content: story.latest_content,
    })),
    lores: apiLores
      .filter((item) => item.public_id !== apiLore?.public_id)
      .map((item) => ({
        kind: "lore" as const,
        id: item.public_id,
        title: item.title,
        content: item.latest_content,
      })),
  });
  // 第 1 頁是最新訊息，載入更早的訊息時往後翻頁；顯示時要反過來，最早的頁在最上面
  const aiMessages = (aiMessagesPages?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.items);
  const visibleAiResult =
    aiResult &&
    !aiMessages.some(
      (message) =>
        message.role === "assistant" &&
        message.agent_id === selectedAgent?.id &&
        message.content.trim() === aiResult.trim(),
    )
      ? aiResult
      : "";
  const panelMessages: StorytellerAgentPanelMessage[] = [
    ...aiMessages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
      speaker:
        message.role === "assistant"
          ? message.agent_name || "AI Agent"
          : "使用者",
    })),
    ...(pendingPrompt
      ? [
          {
            id: "pending-user",
            role: "user" as const,
            content: pendingPrompt,
            speaker: "使用者",
          },
        ]
      : []),
    ...(visibleAiResult
      ? [
          {
            id: `lore-agent-result-${visibleAiResult.length}`,
            role: "assistant" as const,
            content: visibleAiResult,
            speaker: selectedAgent?.name || "AI Agent",
            resultSelection: aiResultSelection,
            isCurrentResult: true,
          },
        ]
      : []),
  ];
  const replyReferenceTarget = replyTarget
    ? {
        id: replyTarget.id,
        speaker: replyTarget.speaker,
        content: replyTarget.content,
      }
    : null;
  const loreReferenceContent =
    buildStorytellerAgentReferenceContent(loreReferences);
  const replyReferenceContent =
    buildStorytellerAgentReplyReferenceContent(replyReferenceTarget);
  const agentContext =
    loreReferenceContent ||
    `Current lore:\n<<<LORE_CONTENT\n${content}\nLORE_CONTENT`;
  const fullAgentContent = [agentContext, replyReferenceContent]
    .filter(Boolean)
    .join("\n\n");
  const replyQuote = buildStorytellerAgentReplyQuote(replyReferenceTarget);
  const aiPromptLength = Array.from(aiPrompt).length;
  const aiInstructionPayloadLength =
    aiPromptLength + (replyQuote ? Array.from(`${replyQuote}\n\n`).length : 0);
  const aiReferenceContentLength = Array.from(fullAgentContent).length;
  const aiPayloadLength = aiInstructionPayloadLength + aiReferenceContentLength;
  const aiPayloadError =
    aiInstructionPayloadLength > aiInstructionMaxCharacters
      ? `輸入需求最多 ${aiInstructionMaxCharacters.toLocaleString()} 字。`
      : aiReferenceContentLength > aiFullContentMaxCharacters
        ? `引用內容最多 ${aiFullContentMaxCharacters.toLocaleString()} 字。`
        : aiPayloadLength > aiTotalPayloadMaxCharacters
          ? `單次 Agent payload 最多 ${aiTotalPayloadMaxCharacters.toLocaleString()} 字。`
          : "";
  const canRunAgent =
    !isNewLore &&
    Boolean(apiProject?.public_id && apiLore?.public_id && selectedAgent) &&
    aiPayloadError === "" &&
    !runAgent.isPending;
  const loreHistoryItems: StoryEditHistoryItem[] = versions.map((version) => ({
    id: String(version.id),
    title: version.title,
    source: "手動編輯",
    createdAt: version.created_at,
    words: version.word_count,
  }));
  const showSnack = (message: string, severity: AlertColor = "success") => {
    setSnack(message);
    setSnackSeverity(severity);
  };

  useEffect(() => {
    setTitle(lore?.title ?? "");
    setContent(lore?.content ?? "");
    const savedDraft = serializeLoreDraft(
      lore?.title ?? "",
      lore?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
  }, [lore?.content, lore?.title]);

  useEffect(() => {
    currentDraftRef.current = serializeLoreDraft(title, content);
    latestDraftRef.current = { title, content };
  }, [content, title]);

  useEffect(() => {
    saveLoreRef.current = saveLore;
  }, [saveLore]);

  // 換 Agent 後，之前選的覆寫金鑰不一定屬於新 Agent 的供應商，重置回「使用預設」
  useEffect(() => {
    setOverrideApiKeyId("");
  }, [selectedAgentId]);

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
              content: latestDraft.content,
            },
          },
          {
            onSuccess: () => {
              lastSavedDraftRef.current = currentDraft;
              showSnack("已自動存檔。");
            },
            onError: (error) =>
              showSnack(errorMessage(error, "設定集自動存檔失敗。"), "error"),
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

  useTitle(`${pageTitle} - Storyteller`, {
    path: id && loreId ? `/storyteller/my/project/${id}/lore/${loreId}` : "",
    robots: "noindex, nofollow",
  });

  if (
    (!project && (projectsPending || projectsFetching)) ||
    (apiProject && !isNewLore && !lore && (loresPending || loresFetching))
  ) {
    return (
      <StorytellerShell
        title="設定集編輯器"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
        ]}
      >
        <StorytellerLoading label="正在載入設定集..." />
      </StorytellerShell>
    );
  }

  if (!project || (!isNewLore && !lore)) {
    return <ErrorPage code={404} />;
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
        input: { title, content },
      },
      {
        onSuccess: (savedLore) => {
          lastSavedDraftRef.current = currentDraftRef.current;
          showSnack("設定集已存檔。");
          if (isNewLore && savedLore?.public_id) {
            navigate(
              `/storyteller/my/project/${projectID}/lore/${savedLore.public_id}`,
            );
          }
        },
        onError: (error) =>
          showSnack(errorMessage(error, "設定集存檔失敗。"), "error"),
      },
    );
  }

  function runSelectedAgent() {
    if (!canRunAgent || !selectedAgent) {
      return;
    }
    const instruction = composeStorytellerAgentInstructionWithReply(
      aiPrompt.trim(),
      replyReferenceTarget,
    );
    // 「取代選取範圍」這次先停用（見 StorytellerAgentPanel 的 enableReplace/enableInsert），
    // 所以這裡不需要再追蹤 textarea 的選取範圍，固定傳 null。
    const resultSelection = null;
    // 立刻把需求顯示在對話列表（樂觀訊息），完成或失敗後再清除
    setPendingPrompt(instruction || "（未輸入需求）");
    setAiPrompt("");
    setReplyTarget(null);
    runAgent.mutate(
      {
        agentId: selectedAgent.id,
        input: {
          mode: "custom_chapter",
          instruction,
          full_content: fullAgentContent,
          selected_content: "",
          provider_apikey_id: overrideApiKeyId
            ? Number(overrideApiKeyId)
            : undefined,
        },
      },
      {
        onSuccess: (result) => {
          setAiResult(result?.result ?? "");
          setAiResultSelection(resultSelection);
        },
        onSettled: () => setPendingPrompt(""),
      },
    );
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

  const comparePath =
    leftVersionId && rightVersionId
      ? `/storyteller/my/project/${project.id}/lore/${lore?.id}/diff/${leftVersionId}/${rightVersionId}`
      : "";

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
      }
      hideHeading
      headerContent={
        <Stack spacing={2}>
          {saveLore.isError && (
            <Alert severity="error" variant="outlined">
              {errorMessage(saveLore.error, "設定集存檔失敗。")}
            </Alert>
          )}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                label="設定集標題"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                fullWidth
                required
                placeholder="請輸入設定集標題"
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
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={handleSave}
                disabled={saveLore.isPending}
                sx={{ py: 1.7 }}
              >
                {saveLore.isPending ? "存檔中" : "存檔"}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: sidePanel ? 7 : 12 }}>
          <StorytellerWysiwygEditor
            value={content}
            onChange={setContent}
            toolbarExtra={
              <StorytellerEditorSideTabs
                value={sidePanel}
                onChange={setSidePanel}
                historyDisabled={isNewLore}
              />
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
                    items={loreHistoryItems}
                    loading={versionsLoading}
                    leftVersionId={leftVersionId}
                    rightVersionId={rightVersionId}
                    comparePath={comparePath}
                    onLeftVersionChange={handleLeftVersionChange}
                    onRightVersionChange={setRightVersionId}
                    isRightVersionDisabled={isRightVersionDisabled}
                    isNewItem={isNewLore}
                    newItemMessage="設定集第一次存檔後才會產生編輯歷史。"
                  />
                </Paper>
              )}

              {sidePanel === "ai" && (
                <StorytellerAgentPanel
                  agents={panelAgents}
                  selectedAgentId={String(selectedAgent?.id ?? "")}
                  onSelectedAgentChange={setSelectedAgentId}
                  messages={panelMessages}
                  messagesLoading={aiMessagesLoading}
                  pending={runAgent.isPending}
                  unavailableMessage={
                    isNewLore
                      ? "設定集第一次存檔後才能呼叫 AI Agent。"
                      : undefined
                  }
                  emptyTitle="還沒有 AI Agent 對話紀錄"
                  emptyDescription="送出需求後，這份設定集的 AI Agent 對話會顯示在這裡。"
                  hasMoreHistory={Boolean(hasMoreAiMessages)}
                  loadingMoreHistory={loadingMoreAiMessages}
                  onLoadMoreHistory={() => void fetchMoreAiMessages()}
                  errorMessage={
                    runAgent.isError
                      ? errorMessage(
                          runAgent.error,
                          "AI Agent 呼叫失敗，請確認 Agent 設定與後端狀態。",
                        )
                      : ""
                  }
                  prompt={aiPrompt}
                  onPromptChange={setAiPrompt}
                  promptPlaceholder="可輸入 Markdown。使用 @thisLore 引用本篇設定集，或輸入 @story:、@lore: 從候選清單插入引用。"
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
                      {loreReferences.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {loreReferences.map((reference) => (
                            <Chip
                              key={reference.token}
                              size="small"
                              color={
                                reference.token === "@thisLore"
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
                  onRun={runSelectedAgent}
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
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity={snackSeverity}
        onClose={() => setSnack("")}
      />
    </StorytellerShell>
  );
}
