import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useRunStorytellerAgent,
  useRunStorytellerAgenticQuery,
  useStorytellerAgentProviderModels,
  useStorytellerProviderAPIKeys,
  useStorytellerStoryChatMessages,
} from "@/apis/storyteller/agent.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { StorytellerMarkdownSyntaxLink } from "@/pages/storyteller/StorytellerMarkdownSyntaxDrawer.tsx";
import { StorytellerAgentReferenceDrawer } from "@/pages/storyteller/StorytellerAgentReferenceDrawer.tsx";
import {
  StorytellerAgentMessage,
  type StorytellerAgentPanelAgent,
  type StorytellerAgentPanelMessage,
  type StorytellerAgentApplyAction,
  type StorytellerAgentPanelSelection,
} from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import type { StorytellerAgenticCurrentStory } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import { StorytellerAgenticProposalCard } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import {
  buildStorytellerAgentReferenceContent,
  buildStorytellerAgentReplyQuote,
  buildStorytellerAgentReplyReferenceContent,
  composeStorytellerAgentInstructionWithReply,
  resolveStorytellerAgentReferences,
} from "@/pages/storyteller/storytellerAgentReferences.ts";
import {
  currentLoreMentionQuery,
  currentStoryMentionQuery,
  insertLoreMention,
  insertStoryMention,
} from "@/pages/storyteller/storytellerAgentEditing.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunResponse,
  StorytellerAgenticProposal,
  StorytellerAgenticStep,
  StorytellerStoryChatMessage,
} from "@/types/storyteller.ts";

// 工具名稱 -> 中文動詞，對照 Codex_UIUX設計提案.md 的建議，不直接把
// storyteller_get_lore 這種名字露給使用者看。
const TOOL_ACTION_LABELS: Record<string, string> = {
  storyteller_list_projects: "列出專案",
  storyteller_get_project: "讀取專案",
  storyteller_list_stories: "列出故事",
  storyteller_get_story: "讀取故事",
  storyteller_list_lores: "列出設定集",
  storyteller_get_lore: "讀取設定集",
  storyteller_list_assets: "列出資產",
  storyteller_get_asset: "讀取資產",
  storyteller_list_asset_collections: "列出資產集",
  storyteller_list_lore_collections: "列出設定集分類",
  storyteller_list_volumes: "列出冊",
};

function toolActionLabel(toolName: string): string {
  return TOOL_ACTION_LABELS[toolName] ?? "建立提案";
}

// 舊「AI Agent」skill 面板降級後的觸發方式：在「AI 助理」輸入框開頭打 `/指令`，
// 不用 slash command 就照舊送進多輪 agentic 問答。見 Phase1至7工作項規劃.md Phase 8。
const SKILL_SLASH_COMMANDS: Record<string, StorytellerAgentRunMode> = {
  rewrite: "rewrite_selection",
  expand: "expand_selection",
  translate: "translate_selection",
  continue: "continue_chapter",
  custom: "custom_chapter",
};
// 給上方指令／人設選單顯示用的中文說明，跟 SKILL_SLASH_COMMANDS 的 key 一一對應。
const SKILL_SLASH_COMMAND_LABELS: Record<string, string> = {
  rewrite: "改寫",
  expand: "擴寫",
  translate: "翻譯",
  continue: "續寫",
  custom: "自訂指令",
};
const SKILL_SLASH_COMMAND_HINT =
  "可用指令：/rewrite /expand /translate /continue /custom（單輪 skill）、/<Agent 名稱> 切換人設（不加指令則直接問答）。一次只會解析最前面那一個指令，後面再打的 / 一律當成一般文字。";

function parseSkillSlashCommand(
  value: string,
): { mode: StorytellerAgentRunMode; instruction: string } | null {
  const match = value.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!match) {
    return null;
  }
  const mode = SKILL_SLASH_COMMANDS[match[1].toLowerCase()];
  if (!mode) {
    return null;
  }
  return { mode, instruction: match[2] };
}

// /<Agent 名稱> 切換人設——不透過下拉選單，靠打字（或點上方 chip 塞入字串）。
// Agent 名稱可能含空白（例如 "Plot Doctor"），不能只切第一個詞，改成看輸入是否
// 以某個 Agent 名稱開頭；同名前綴（例如「色文」跟「色文作家」）取最長的那個，
// 避免比對到錯誤的 Agent。skill mode 指令（/rewrite 等）是保留字，優先權更高，
// 呼叫端要先跑 parseSkillSlashCommand 沒中才輪到這裡。
function matchAgentNameCommand(
  value: string,
  agents: StorytellerAgentPanelAgent[],
): { agentId: string; instruction: string } | null {
  if (!value.startsWith("/")) {
    return null;
  }
  const rest = value.slice(1);
  let best: { agentId: string; nameLength: number; instruction: string } | null =
    null;
  for (const agent of agents) {
    const name = agent.name.trim();
    if (!name || !rest.toLowerCase().startsWith(name.toLowerCase())) {
      continue;
    }
    if (!best || name.length > best.nameLength) {
      best = {
        agentId: agent.id,
        nameLength: name.length,
        instruction: rest.slice(name.length).trim(),
      };
    }
  }
  return best ? { agentId: best.agentId, instruction: best.instruction } : null;
}

const skillMessagesPerPage = 10;
const skillInstructionMaxCharacters = 4000;
const skillFullContentMaxCharacters = 60000;
const skillTotalPayloadMaxCharacters = 80000;

// 沿用既有 StoryEditor.tsx 的 aiErrorMessage() 邏輯：後端錯誤訊息在
// response.data.message，axios 預設的 "Request failed with status code
// 503" 對使用者沒有意義。
function agenticErrorMessage(error: unknown): string {
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
  return "AI 助理呼叫失敗，請確認 Agent 設定與後端狀態。";
}

// 同一個對話串裡混了兩種來源的訊息：slash command 觸發的單輪 skill（改寫/擴寫/
// 翻譯/續寫），跟純文字觸發的多輪 agentic 問答，兩者資料模型跟渲染方式都不同，
// 用 kind 分流；sortKey 讓 skill 的歷史訊息（存在 DB，可能很舊）跟 agentic 的
// session 訊息（只存在這次對話，未持久化）能照時間正確交錯顯示。
type PanelMessage =
  | ({ kind: "skill"; sortKey: number } & StorytellerAgentPanelMessage)
  | {
      kind: "agentic";
      sortKey: number;
      id: string;
      role: "user" | "assistant";
      content: string;
      steps?: StorytellerAgenticStep[];
      proposals?: StorytellerAgenticProposal[];
      usage?: { total_tokens?: number };
      warning?: string;
      isLoading?: boolean;
    };

function ToolTraceSummary({ steps }: { steps: StorytellerAgenticStep[] }) {
  const [expanded, setExpanded] = useState(false);
  const calls = steps.flatMap((step) => step.tool_calls);
  if (calls.length === 0) {
    return null;
  }
  const errorCount = steps
    .flatMap((step) => step.results)
    .filter((result) => Boolean(result.error)).length;

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 1, overflow: "hidden", mt: 1 }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 0.75, cursor: "pointer" }}
        onClick={() => setExpanded((value) => !value)}
      >
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: "text.secondary",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
        <Typography variant="caption" color="text.secondary">
          工作軌跡：讀取 {calls.length} 項
          {errorCount > 0 ? ` · ${errorCount} 個錯誤` : ""}
        </Typography>
      </Stack>
      <Collapse in={expanded}>
        <Stack sx={{ borderTop: 1, borderColor: "divider" }}>
          {steps.flatMap((step, stepIndex) =>
            step.tool_calls.map((call, callIndex) => {
              const result = step.results[callIndex];
              const failed = Boolean(result?.error);
              return (
                <Stack
                  key={`${stepIndex}-${callIndex}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ px: 1.5, py: 0.75, fontSize: 12.5 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ minWidth: 72 }}
                  >
                    {toolActionLabel(call.name)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {JSON.stringify(call.arguments)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={failed ? "error" : "success.main"}
                  >
                    {failed ? "失敗" : "成功"}
                  </Typography>
                </Stack>
              );
            }),
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}

function AgenticAssistantMessage({
  message,
  projectPublicId,
  storyPublicId,
  currentStory,
  onStoryChanged,
}: {
  message: Extract<PanelMessage, { kind: "agentic" }>;
  projectPublicId?: string;
  storyPublicId?: string;
  currentStory: StorytellerAgenticCurrentStory;
  onStoryChanged?: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: message.role === "user" ? "flex-end" : "flex-start",
      }}
    >
      <Box
        sx={{
          maxWidth: "94%",
          p: 1.5,
          borderRadius: 1,
          bgcolor: message.role === "user" ? "primary.main" : "background.paper",
          color: message.role === "user" ? "primary.contrastText" : "text.primary",
          border: message.role === "user" ? 0 : "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="caption"
          color={message.role === "user" ? "inherit" : "text.secondary"}
        >
          {message.role === "user" ? "你" : "AI 助理"}
        </Typography>
        {message.isLoading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              處理中...
            </Typography>
          </Stack>
        ) : (
          message.content && (
            <Box sx={{ typography: "body2", mt: 0.5 }}>
              <StorytellerMarkdown>{message.content}</StorytellerMarkdown>
            </Box>
          )
        )}
        {message.warning && (
          <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
            {message.warning}
          </Alert>
        )}
        {message.steps && message.steps.length > 0 && (
          <ToolTraceSummary steps={message.steps} />
        )}
        {message.proposals && message.proposals.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {message.proposals.map((proposal, index) => (
              <StorytellerAgenticProposalCard
                key={proposal.tool_call_id || index}
                index={index}
                proposal={proposal}
                projectPublicId={projectPublicId}
                storyPublicId={storyPublicId}
                currentStory={currentStory}
                onApplied={onStoryChanged}
              />
            ))}
          </Stack>
        )}
        {message.usage?.total_tokens ? (
          <Chip
            size="small"
            label={`${message.usage.total_tokens} tokens`}
            sx={{ mt: 1 }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

export function StorytellerAgenticPanel({
  projectPublicId,
  storyPublicId,
  agents,
  currentStory,
  otherStories,
  lores,
  penName,
  onApplyText,
  onStoryChanged,
}: {
  projectPublicId?: string;
  storyPublicId?: string;
  agents: StorytellerAgentPanelAgent[];
  currentStory: StorytellerAgenticCurrentStory;
  otherStories: { id: string; title: string; content: string }[];
  lores: { id: string; title: string; content: string }[];
  penName?: string;
  onApplyText: (
    text: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  onStoryChanged?: () => void;
}) {
  // 沒有下拉選單了——人設一律靠輸入框打 /<Agent 名稱> 切換（見 matchAgentNameCommand），
  // 這裡只保留「目前是哪一個」的內部狀態，agents 清單變動（新增/刪除/重新整理）時
  // 若目前選的 id 已經不在清單裡，退回清單第一個。
  const [activeAgentId, setActiveAgentId] = useState(agents[0]?.id ?? "");
  useEffect(() => {
    if (!agents.some((agent) => agent.id === activeAgentId)) {
      setActiveAgentId(agents[0]?.id ?? "");
    }
  }, [agents, activeAgentId]);
  const [prompt, setPrompt] = useState("");
  const [providerApiKeyId, setProviderApiKeyId] = useState("");
  const [modelNameOverride, setModelNameOverride] = useState("");
  const [apiKeyMenuAnchor, setApiKeyMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [modelMenuAnchor, setModelMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [agentMenuAnchor, setAgentMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [replyTarget, setReplyTarget] =
    useState<StorytellerAgentPanelMessage | null>(null);
  const [optimisticSkillMessage, setOptimisticSkillMessage] =
    useState<PanelMessage | null>(null);
  const [skillResult, setSkillResult] = useState<{
    agentId: number;
    response: StorytellerAgentRunResponse;
    resultSelection: StorytellerAgentPanelSelection | null;
  } | null>(null);
  const [agenticMessages, setAgenticMessages] = useState<
    Extract<PanelMessage, { kind: "agentic" }>[]
  >([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingSkillIdRef = useRef(0);
  // session 訊息（agentic 全部、skill 的樂觀/暫時結果）只存在這次對話，沒有伺服器
  // 時間戳可用；用一個保留在 epoch 毫秒值上限之上的遞增計數器當排序鍵，保證一定
  // 排在所有從伺服器讀到的歷史訊息之後，同時避免在 render 中呼叫 Date.now()
  // 觸發 react-hooks/purity 規則。
  const sessionSortKeyBaseRef = useRef(Number.MAX_SAFE_INTEGER - 1_000_000);
  function nextSessionSortKey() {
    sessionSortKeyBaseRef.current += 1;
    return sessionSortKeyBaseRef.current;
  }
  const [referenceDrawerOpen, setReferenceDrawerOpen] = useState(false);

  const selectedAgent =
    agents.find((agent) => agent.id === activeAgentId) ?? agents[0];
  const agentIdNumeric = Number(selectedAgent?.id);

  const { data: providerApiKeys = [], isLoading: providerApiKeysLoading } =
    useStorytellerProviderAPIKeys();
  const { data: providerModelsList = [] } = useStorytellerAgentProviderModels();
  // 换 key 可以跨 provider（見 Agent／provider/key/model 解耦），所以這裡不再
  // 依 selectedAgent.provider 篩選——任何一把已設定的 key 都能拿來跑這個 Agent。
  const overrideApiKeyOptions = providerApiKeys;
  // Skill 已經跟 provider/key/model 完全剝離，不存在「Agent 自己的預設 key」這回事
  // 了（新建的 Skill 一律沒有綁定，見 Phase 8.7）；金鑰/模型變成純粹的 session 選擇，
  // 不隨切換 Agent 重置——只要目前選的 key 還在清單裡就保留，沒有才自動挑第一把。
  useEffect(() => {
    if (
      providerApiKeyId &&
      overrideApiKeyOptions.some(
        (apiKey) => String(apiKey.id) === providerApiKeyId,
      )
    ) {
      return;
    }
    if (overrideApiKeyOptions.length > 0) {
      setProviderApiKeyId(String(overrideApiKeyOptions[0].id));
    }
  }, [overrideApiKeyOptions, providerApiKeyId]);
  const overriddenApiKey = providerApiKeyId
    ? providerApiKeys.find((apiKey) => String(apiKey.id) === providerApiKeyId)
    : undefined;
  // 實際生效的 provider：一定看目前選的 key（上面那個 effect 保證只要有 key 就一定
  // 選了一把），沒有 key 時才退回 Agent 記錄的（多半也是空字串）。
  const effectiveProvider = overriddenApiKey?.provider ?? selectedAgent?.provider;
  const effectiveProviderModelInfo = providerModelsList.find(
    (entry) => entry.provider === effectiveProvider,
  );
  const modelOptions = effectiveProviderModelInfo?.models ?? [];
  // self_hosted／openrouter 這類 provider 沒有固定模型清單（models 可能是空的），
  // 改成讓使用者直接輸入模型名稱，而不是完全選不了。
  const providerAllowsCustomModel = Boolean(
    effectiveProviderModelInfo?.allow_custom_model,
  );
  const [customModelInput, setCustomModelInput] = useState("");

  // 跟金鑰同理，不存在「Agent 自己的預設模型」——固定清單的 provider 沒選過模型時
  // 自動挑清單第一個；換了不同 provider 的 key、先前選的模型不在新清單裡時，同樣
  // 改選新清單第一個，而不是清空退回一個不存在的「預設」。允許自訂模型名稱的
  // provider（models 清單本來就是空的）不受這條規則影響，不然使用者剛打完字就會
  // 被清空、清單也沒有東西可以自動選。
  useEffect(() => {
    if (providerAllowsCustomModel || modelOptions.length === 0) {
      return;
    }
    if (modelOptions.some((model) => model.name === modelNameOverride)) {
      return;
    }
    setModelNameOverride(modelOptions[0].name);
  }, [modelOptions, modelNameOverride, providerAllowsCustomModel]);

  const runSkillMutation = useRunStorytellerAgent(
    projectPublicId,
    storyPublicId,
  );
  const runAgenticQuery = useRunStorytellerAgenticQuery(
    projectPublicId,
    storyPublicId,
  );
  const {
    data: skillMessagesPages,
    isLoading: skillMessagesLoading,
    hasNextPage: hasMoreSkillHistory,
    isFetchingNextPage: loadingMoreSkillHistory,
    fetchNextPage: fetchMoreSkillHistory,
  } = useStorytellerStoryChatMessages(
    projectPublicId,
    storyPublicId,
    skillMessagesPerPage,
  );

  // 第 1 頁是最新訊息，載入更早的訊息時往後翻頁；顯示時要反過來，最早的頁在最上面
  const rawSkillMessages: StorytellerStoryChatMessage[] = (
    skillMessagesPages?.pages ?? []
  )
    .slice()
    .reverse()
    .flatMap((page) => page.items);
  // skillResult 是這次執行剛拿到、尚未確定已經進到（invalidate 後重新抓取的）歷史
  // 清單裡的暫時結果；一旦歷史清單也出現同樣內容，代表已經是「正式」的那一則，
  // 這裡先濾掉暫時結果對應的那筆，避免同一則回應顯示兩次。
  const visibleSkillMessages = skillResult
    ? rawSkillMessages.filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.agent_id === skillResult.agentId &&
            message.content.trim() === skillResult.response.result.trim()
          ),
      )
    : rawSkillMessages;

  function skillMessageSpeaker(message: StorytellerStoryChatMessage) {
    if (message.role === "assistant") {
      return message.agent_name || selectedAgent?.name || "AI 助理";
    }
    if (message.role === "user") {
      return penName || "使用者";
    }
    return "System";
  }

  const skillHistoryMessages: PanelMessage[] = visibleSkillMessages.map(
    (message) => ({
      kind: "skill",
      sortKey: new Date(message.created_at).getTime(),
      id: String(message.id),
      role: message.role,
      content: message.content,
      speaker: skillMessageSpeaker(message),
    }),
  );
  const skillTransientMessages: PanelMessage[] = [];
  if (optimisticSkillMessage) {
    skillTransientMessages.push(optimisticSkillMessage);
  }
  if (skillResult) {
    skillTransientMessages.push({
      kind: "skill",
      sortKey: Number.MAX_SAFE_INTEGER,
      id: `skill-result-${skillResult.agentId}-${skillResult.response.result.length}`,
      role: "assistant",
      content: skillResult.response.result,
      speaker: selectedAgent?.name ?? "AI 助理",
      mode: skillResult.response.mode,
      usage: skillResult.response.usage,
      resultSelection: skillResult.resultSelection,
      isCurrentResult: true,
    });
  }

  const combinedMessages: PanelMessage[] = [
    ...skillHistoryMessages,
    ...skillTransientMessages,
    ...agenticMessages,
  ].sort((a, b) => a.sortKey - b.sortKey);

  useLayoutEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [combinedMessages.length, runSkillMutation.isPending, runAgenticQuery.isPending]);

  const promptReferences = resolveStorytellerAgentReferences({
    prompt,
    currentStory: {
      kind: "story",
      id: currentStory.title,
      title: currentStory.title,
      content: currentStory.content,
    },
    stories: otherStories.map((story) => ({
      kind: "story" as const,
      id: story.id,
      title: story.title,
      content: story.content,
    })),
    lores: lores.map((lore) => ({
      kind: "lore" as const,
      id: lore.id,
      title: lore.title,
      content: lore.content,
    })),
  });
  const replyReferenceTarget = replyTarget
    ? { id: replyTarget.id, speaker: replyTarget.speaker, content: replyTarget.content }
    : null;
  const referenceContent = [
    buildStorytellerAgentReferenceContent(promptReferences),
    buildStorytellerAgentReplyReferenceContent(replyReferenceTarget),
  ]
    .filter(Boolean)
    .join("\n\n");
  const replyQuote = buildStorytellerAgentReplyQuote(replyReferenceTarget);
  const promptLength = Array.from(prompt).length;
  const instructionPayloadLength =
    promptLength + (replyQuote ? Array.from(`${replyQuote}\n\n`).length : 0);
  const referenceContentLength = Array.from(referenceContent).length;
  const totalPayloadLength = instructionPayloadLength + referenceContentLength;
  const payloadError =
    instructionPayloadLength > skillInstructionMaxCharacters
      ? `輸入需求最多 ${skillInstructionMaxCharacters.toLocaleString()} 字。`
      : referenceContentLength > skillFullContentMaxCharacters
        ? `引用內容最多 ${skillFullContentMaxCharacters.toLocaleString()} 字。`
        : totalPayloadLength > skillTotalPayloadMaxCharacters
          ? `單次 Agent payload 最多 ${skillTotalPayloadMaxCharacters.toLocaleString()} 字。`
          : "";
  const storyMentionQuery = currentStoryMentionQuery(prompt);
  const loreMentionQuery = currentLoreMentionQuery(prompt);
  const storyMentionOptions =
    storyMentionQuery === null
      ? []
      : otherStories
          .filter((item) =>
            item.title.toLowerCase().includes(storyMentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const loreMentionOptions =
    loreMentionQuery === null
      ? []
      : lores
          .filter((item) =>
            item.title.toLowerCase().includes(loreMentionQuery.toLowerCase()),
          )
          .slice(0, 6);

  const pending = runSkillMutation.isPending || runAgenticQuery.isPending;
  // Skill 已經跟 provider/model/apikey 剝離，「Agent 預設金鑰」不再保證真的有預設可
  // 用——完全沒有任何一把 key 時，不管選哪個 Agent、打哪個指令都注定失敗，直接整個
  // 鎖死送出跟模型 chip，用 Alert 導去金鑰管理，比讓使用者送出後才看到後端錯誤好。
  const hasAnyApiKey = providerApiKeys.length > 0;
  const canRun =
    hasAnyApiKey &&
    Boolean(prompt.trim()) &&
    Boolean(projectPublicId) &&
    Boolean(storyPublicId) &&
    Number.isFinite(agentIdNumeric) &&
    Boolean(selectedAgent?.enabled) &&
    payloadError === "" &&
    !pending;

  function runSkill(mode: StorytellerAgentRunMode, instructionRaw: string) {
    const instruction = composeStorytellerAgentInstructionWithReply(
      instructionRaw.trim(),
      replyReferenceTarget,
    );
    pendingSkillIdRef.current += 1;
    setOptimisticSkillMessage({
      kind: "skill",
      sortKey: Number.MAX_SAFE_INTEGER,
      id: `skill-pending-${pendingSkillIdRef.current}`,
      role: "user",
      content: instruction.trim() || "（未輸入需求）",
      speaker: penName || "使用者",
    });
    setPrompt("");
    setReplyTarget(null);

    runSkillMutation.mutate(
      {
        agentId: agentIdNumeric,
        input: {
          mode,
          instruction,
          full_content: referenceContent,
          selected_content: "",
          provider_apikey_id: providerApiKeyId
            ? Number(providerApiKeyId)
            : undefined,
          model_name: modelNameOverride || undefined,
        },
      },
      {
        onSuccess: (result) => {
          if (!result) {
            return;
          }
          setSkillResult({
            agentId: agentIdNumeric,
            response: result,
            resultSelection: null,
          });
        },
        onSettled: () => {
          setOptimisticSkillMessage(null);
        },
      },
    );
  }

  function runAgentic(instruction: string) {
    const userSortKey = nextSessionSortKey();
    const userMessage: Extract<PanelMessage, { kind: "agentic" }> = {
      kind: "agentic",
      sortKey: userSortKey,
      id: `agentic-user-${userSortKey}`,
      role: "user",
      content: instruction,
    };
    setAgenticMessages((prev) => [...prev, userMessage]);
    setPrompt("");

    runAgenticQuery.mutate(
      {
        agentId: agentIdNumeric,
        input: {
          user_prompt: instruction,
          provider_apikey_id: providerApiKeyId
            ? Number(providerApiKeyId)
            : undefined,
          model_name: modelNameOverride || undefined,
        },
      },
      {
        onSuccess: (response) => {
          if (!response) {
            return;
          }
          const assistantSortKey = nextSessionSortKey();
          setAgenticMessages((prev) => [
            ...prev,
            {
              kind: "agentic",
              sortKey: assistantSortKey,
              id: `agentic-assistant-${assistantSortKey}`,
              role: "assistant",
              content: response.result,
              steps: response.steps,
              proposals: response.proposals,
              usage: response.usage,
              warning: response.warning,
            },
          ]);
        },
        onError: (err) => {
          const errorSortKey = nextSessionSortKey();
          setAgenticMessages((prev) => [
            ...prev,
            {
              kind: "agentic",
              sortKey: errorSortKey,
              id: `agentic-error-${errorSortKey}`,
              role: "assistant",
              content: "",
              warning: agenticErrorMessage(err),
            },
          ]);
        },
      },
    );
  }

  function handleSend() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    // /<Agent 名稱> 純粹是切人設，不打 API，所以不受 canRun（需要 project/story/
    // 目前 Agent 可用）限制——就算目前選到的 Agent 是停用狀態，也要能透過這個指令
    // 換到別的 Agent。
    const agentSwitch = matchAgentNameCommand(trimmed, agents);
    if (agentSwitch) {
      setActiveAgentId(agentSwitch.agentId);
      setPrompt(agentSwitch.instruction);
      return;
    }
    if (!canRun || !Number.isFinite(agentIdNumeric)) {
      return;
    }
    const slash = parseSkillSlashCommand(trimmed);
    if (slash) {
      runSkill(slash.mode, slash.instruction);
      return;
    }
    runAgentic(composeStorytellerAgentInstructionWithReply(trimmed, replyReferenceTarget));
  }

  function insertAgentSlashPrefix(name: string) {
    setPrompt((current) => {
      const existing = matchAgentNameCommand(current, agents);
      const rest = existing ? existing.instruction : current;
      return `/${name} ${rest}`;
    });
  }

  function insertSkillSlashPrefix(word: string) {
    setPrompt((current) => {
      const existing = parseSkillSlashCommand(current);
      const rest = existing ? existing.instruction : current;
      return `/${word} ${rest}`;
    });
  }

  function handleReply(message: StorytellerAgentPanelMessage) {
    setReplyTarget(message);
  }

  function scrollToReplyTarget() {
    if (!replyTarget) {
      return;
    }
    const node = messagesContainerRef.current?.querySelector(
      `[data-agent-message-id="${CSS.escape(replyTarget.id)}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const skillErrorMessage = runSkillMutation.isError
    ? agenticErrorMessage(runSkillMutation.error)
    : "";

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        overflow: "hidden",
        position: { lg: "sticky" },
        top: { lg: 16 },
      }}
    >
      <Stack sx={{ height: { lg: 720 }, maxHeight: { lg: 720 } }}>
        <Stack spacing={1.5} sx={{ p: 2, bgcolor: "background.default" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 120 }}>
              <SmartToyIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>
                AI 助理
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="text"
              color="inherit"
              endIcon={<KeyboardArrowDownIcon fontSize="small" />}
              onClick={(event) => setAgentMenuAnchor(event.currentTarget)}
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              {selectedAgent?.name ?? "尚未建立 Agent"}
            </Button>
            <Menu
              anchorEl={agentMenuAnchor}
              open={Boolean(agentMenuAnchor)}
              onClose={() => setAgentMenuAnchor(null)}
            >
              <ListSubheader>切換人設（/Agent 名稱）</ListSubheader>
              {agents.length === 0 && (
                <MenuItem disabled>尚未建立任何 Agent</MenuItem>
              )}
              {agents.map((agent) => (
                <MenuItem
                  key={agent.id}
                  selected={agent.id === selectedAgent?.id}
                  onClick={() => {
                    insertAgentSlashPrefix(agent.name);
                    setAgentMenuAnchor(null);
                  }}
                >
                  {agent.name}
                </MenuItem>
              ))}
              <ListSubheader>單輪指令</ListSubheader>
              {Object.entries(SKILL_SLASH_COMMANDS).map(([word]) => (
                <MenuItem
                  key={word}
                  onClick={() => {
                    insertSkillSlashPrefix(word);
                    setAgentMenuAnchor(null);
                  }}
                >
                  /{word}（{SKILL_SLASH_COMMAND_LABELS[word]}）
                </MenuItem>
              ))}
            </Menu>
          </Stack>
          {!storyPublicId && (
            <Alert severity="info" variant="outlined">
              新故事第一次存檔後才能使用 AI 助理。
            </Alert>
          )}
          {!providerApiKeysLoading && !hasAnyApiKey && (
            <Alert
              severity="warning"
              variant="outlined"
              action={
                <Button
                  component={RouterLink}
                  to={steamloomPath("my/api-keys")}
                  size="small"
                >
                  前往設定
                </Button>
              }
            >
              請先至「金鑰管理」建立至少一把 API Key，AI 助理才能真的呼叫模型。
            </Alert>
          )}
        </Stack>

        <Stack
          ref={messagesContainerRef}
          spacing={1.5}
          sx={{
            flex: 1,
            minHeight: { xs: 360, lg: 0 },
            maxHeight: { xs: 520, lg: 480 },
            overflow: "auto",
            bgcolor: "background.default",
            p: 2,
            borderTop: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {skillMessagesLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                正在載入對話紀錄...
              </Typography>
            </Stack>
          ) : combinedMessages.length > 0 || pending ? (
            <>
              {hasMoreSkillHistory && (
                <Stack direction="row" justifyContent="center">
                  <Button
                    size="small"
                    variant="text"
                    disabled={loadingMoreSkillHistory}
                    onClick={() => void fetchMoreSkillHistory()}
                    startIcon={
                      loadingMoreSkillHistory ? (
                        <CircularProgress size={14} />
                      ) : undefined
                    }
                  >
                    {loadingMoreSkillHistory ? "載入中..." : "載入更早的訊息"}
                  </Button>
                </Stack>
              )}
              {combinedMessages.map((message) =>
                message.kind === "skill" ? (
                  <StorytellerAgentMessage
                    key={message.id}
                    message={message}
                    enableReplace={false}
                    enableInsert={false}
                    onApplyText={onApplyText}
                    onReply={handleReply}
                    isReplyTarget={replyTarget?.id === message.id}
                  />
                ) : (
                  <AgenticAssistantMessage
                    key={message.id}
                    message={message}
                    projectPublicId={projectPublicId}
                    storyPublicId={storyPublicId}
                    currentStory={currentStory}
                    onStoryChanged={onStoryChanged}
                  />
                ),
              )}
              {runSkillMutation.isPending && (
                <StorytellerAgentMessage
                  message={{
                    id: "skill-pending-loading",
                    role: "assistant",
                    content: "",
                    speaker: selectedAgent?.name ?? "AI 助理",
                    isLoading: true,
                  }}
                  enableReplace={false}
                  enableInsert={false}
                  onApplyText={onApplyText}
                />
              )}
              {runAgenticQuery.isPending && (
                <AgenticAssistantMessage
                  message={{
                    kind: "agentic",
                    sortKey: Number.MAX_SAFE_INTEGER,
                    id: "agentic-pending-loading",
                    role: "assistant",
                    content: "",
                    isLoading: true,
                  }}
                  projectPublicId={projectPublicId}
                  storyPublicId={storyPublicId}
                  currentStory={currentStory}
                  onStoryChanged={onStoryChanged}
                />
              )}
            </>
          ) : (
            <CustomEmptyState
              icon={<SmartToyIcon fontSize="large" />}
              title="還沒有對話"
              description="直接輸入問題會啟動可以自己讀資料、提出修改提案的多輪問答；打 /rewrite、/expand 等指令則是單輪的改寫/擴寫/翻譯 skill。"
            />
          )}
          {skillErrorMessage && (
            <Alert severity="error" variant="outlined">
              {skillErrorMessage}
            </Alert>
          )}
        </Stack>

        <Stack spacing={1.5} sx={{ p: 2 }}>
          {replyTarget && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                pl: 1.25,
                pr: 0.5,
                py: 0.5,
                borderLeft: "3px solid",
                borderColor: "primary.main",
                bgcolor: "action.hover",
                borderRadius: 0.5,
              }}
            >
              <Box
                onClick={scrollToReplyTarget}
                sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
              >
                <Typography variant="caption" color="text.secondary">
                  回覆 {replyTarget.speaker}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {replyTarget.content}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setReplyTarget(null)}>
                取消
              </Button>
            </Stack>
          )}
          <TextField
            multiline
            minRows={3}
            maxRows={8}
            label="輸入需求"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：幫我把這段開頭改得更懸疑一點；或輸入 /rewrite 更懸疑一點 觸發單輪改寫。"
            error={Boolean(payloadError)}
            helperText={payloadError || SKILL_SLASH_COMMAND_HINT}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="text"
              color="inherit"
              endIcon={<KeyboardArrowDownIcon fontSize="small" />}
              onClick={(event) => setApiKeyMenuAnchor(event.currentTarget)}
              disabled={!hasAnyApiKey}
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              {overriddenApiKey
                ? overriddenApiKey.label || `金鑰 #${overriddenApiKey.id}`
                : "預設金鑰"}
            </Button>
            <Menu
              anchorEl={apiKeyMenuAnchor}
              open={Boolean(apiKeyMenuAnchor)}
              onClose={() => setApiKeyMenuAnchor(null)}
            >
              {overrideApiKeyOptions.map((apiKey) => (
                <MenuItem
                  key={apiKey.id}
                  selected={providerApiKeyId === String(apiKey.id)}
                  onClick={() => {
                    setProviderApiKeyId(String(apiKey.id));
                    setApiKeyMenuAnchor(null);
                  }}
                >
                  {apiKey.label || `金鑰 #${apiKey.id}`}（{apiKey.provider}）
                </MenuItem>
              ))}
            </Menu>

            <Button
              size="small"
              variant="text"
              color="inherit"
              endIcon={<KeyboardArrowDownIcon fontSize="small" />}
              onClick={(event) => {
                if (providerAllowsCustomModel && modelOptions.length === 0) {
                  setCustomModelInput(modelNameOverride);
                }
                setModelMenuAnchor(event.currentTarget);
              }}
              disabled={
                !hasAnyApiKey ||
                (modelOptions.length === 0 && !providerAllowsCustomModel)
              }
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              {modelNameOverride || selectedAgent?.model || "預設模型"}
            </Button>
            {providerAllowsCustomModel && modelOptions.length === 0 ? (
              <Menu
                anchorEl={modelMenuAnchor}
                open={Boolean(modelMenuAnchor)}
                onClose={() => setModelMenuAnchor(null)}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 1 }}
                >
                  <TextField
                    autoFocus
                    size="small"
                    label="自訂模型名稱"
                    placeholder="例如：llama-3.1-70b"
                    value={customModelInput}
                    onChange={(event) => setCustomModelInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setModelNameOverride(customModelInput.trim());
                        setModelMenuAnchor(null);
                      }
                    }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      setModelNameOverride(customModelInput.trim());
                      setModelMenuAnchor(null);
                    }}
                  >
                    套用
                  </Button>
                </Stack>
              </Menu>
            ) : (
              <Menu
                anchorEl={modelMenuAnchor}
                open={Boolean(modelMenuAnchor)}
                onClose={() => setModelMenuAnchor(null)}
              >
                {modelOptions.map((model) => (
                  <MenuItem
                    key={model.id}
                    selected={modelNameOverride === model.name}
                    onClick={() => {
                      setModelNameOverride(model.name);
                      setModelMenuAnchor(null);
                    }}
                  >
                    {model.label || model.name}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <StorytellerMarkdownSyntaxLink />
            <Button
              size="small"
              variant="text"
              onClick={() => setReferenceDrawerOpen(true)}
            >
              引用標籤說明
            </Button>
          </Stack>
          {promptReferences.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {promptReferences.map((reference) => (
                <Chip
                  key={reference.token}
                  size="small"
                  color={reference.token === "@thisStory" ? "primary" : "default"}
                  label={reference.title}
                />
              ))}
            </Stack>
          )}
          {storyMentionOptions.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {storyMentionOptions.map((item) => (
                <Button
                  key={item.id}
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setPrompt((current) => insertStoryMention(current, item.title))
                  }
                >
                  {item.title}
                </Button>
              ))}
            </Stack>
          )}
          {loreMentionOptions.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {loreMentionOptions.map((item) => (
                <Button
                  key={item.id}
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setPrompt((current) => insertLoreMention(current, item.title))
                  }
                >
                  設定集：{item.title}
                </Button>
              ))}
            </Stack>
          )}
          <Tooltip title={SKILL_SLASH_COMMAND_HINT}>
            <span>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!canRun}
                onClick={handleSend}
              >
                {pending ? "處理中" : "送出"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <StorytellerAgentReferenceDrawer
        open={referenceDrawerOpen}
        onClose={() => setReferenceDrawerOpen(false)}
      />
    </Paper>
  );
}
