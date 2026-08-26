import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReplyIcon from "@mui/icons-material/Reply";
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
  useRunStorytellerLoreAgent,
  useRunStorytellerLoreAgenticQuery,
  useStorytellerAgentProviderModels,
  useStorytellerLoreChatMessages,
  useStorytellerProviderAPIKeys,
  useStorytellerStoryChatMessages,
} from "@/apis/storyteller/agent.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { StorytellerMarkdownSyntaxLink } from "@/pages/storyteller/StorytellerMarkdownSyntaxDrawer.tsx";
import { StorytellerAgentReferenceDrawer } from "@/pages/storyteller/StorytellerAgentReferenceDrawer.tsx";
import { StorytellerPromptHighlightOverlay } from "@/pages/storyteller/StorytellerPromptHighlightOverlay.tsx";
import {
  StorytellerAgentLoadingHint,
  StorytellerAgentMessage,
  StorytellerChatBadges,
  StorytellerChatBubble,
  storytellerChatActionButtonProps,
  type StorytellerAgentPanelAgent,
  type StorytellerAgentPanelMessage,
  type StorytellerAgentApplyAction,
  type StorytellerAgentPanelSelection,
} from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import type { StorytellerAgenticCurrentStory } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import { StorytellerAgenticProposalCard } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import {
  buildStorytellerAgentMessageLinks,
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
  "打 / 可觸發單輪 skill 或切換人設，也可以用上方選單插入；完整說明見下方「指令 / 引用說明」。";

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
  let best: {
    agentId: string;
    nameLength: number;
    instruction: string;
  } | null = null;
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
      // 這則實際是哪個 Agent 人設處理的——事後回頭看對話紀錄才追得回「這則
      // 當時發生了什麼事」，見 StorytellerAgentPanel.tsx 的 StorytellerChatBadges。
      agentName?: string;
    };

// 工作軌跡只顯示「參數裡的 id 類欄位」（project_public_id／story_public_id／
// lore_public_id／collection_id／volume_public_id／base_version_id 等），
// 其餘欄位一律拋棄——尤其是 storyteller_upsert_story／storyteller_upsert_lore
// 這類寫入工具，arguments.content 就是 AI 準備寫入的整篇內容，原封不動塞進
// 這個除錯用的摺疊區塊沒有閱讀價值，只是多一個曝光點；id 類欄位本身是不透明
// 雜湊值/版本號，看得出「讀了哪篇故事/設定」但不會洩漏內容本身，兩者兼顧。
// 用尾碼比對（"_id" 結尾或字面 "id"）而不是列舉固定欄位名單，之後
// tool_registry_*.go 新增工具只要遵循現有命名慣例，這裡不用跟著改。
function toolCallDisplayArguments(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([key]) => key === "id" || key.endsWith("_id"))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

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
                    {toolCallDisplayArguments(call.arguments)}
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
  targetKind,
  projectPublicId,
  targetPublicId,
  otherStories,
  lores,
  currentStory,
  onStoryChanged,
  onApplyText,
  onApplyProposalToEditor,
  onReply,
  isReplyTarget,
}: {
  message: Extract<PanelMessage, { kind: "agentic" }>;
  targetKind: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
  otherStories: { id: string; title: string; content: string }[];
  lores: { id: string; title: string; content: string }[];
  currentStory: StorytellerAgenticCurrentStory;
  onStoryChanged?: () => void;
  onApplyText?: (
    content: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  onApplyProposalToEditor?: (
    proposal: StorytellerAgenticProposal,
  ) => Promise<void>;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  isReplyTarget?: boolean;
}) {
  const isUser = message.role === "user";
  const canApply =
    !isUser && !message.isLoading && message.content.trim() !== "";
  const linkedContent = buildStorytellerAgentMessageLinks(message.content, {
    targetKind,
    projectPublicId,
    targetPublicId,
    otherStories,
    lores,
  });
  return (
    <StorytellerChatBubble
      messageId={message.id}
      isUser={isUser}
      isReplyTarget={isReplyTarget}
      speaker={isUser ? "你" : "AI 助理"}
      badge={<StorytellerChatBadges agentName={message.agentName} />}
    >
      {message.isLoading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            <StorytellerAgentLoadingHint />
          </Typography>
        </Stack>
      ) : (
        message.content && (
          <Box sx={{ typography: "body2", mt: 0.5 }}>
            <StorytellerMarkdown>{linkedContent}</StorytellerMarkdown>
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
              targetKind={targetKind}
              projectPublicId={projectPublicId}
              targetPublicId={targetPublicId}
              currentStory={currentStory}
              onApplied={onStoryChanged}
              onApplyToEditor={onApplyProposalToEditor}
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
      {canApply && onApplyText && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          <Button
            {...storytellerChatActionButtonProps}
            startIcon={<ContentCopyIcon />}
            onClick={() => onApplyText(message.content, "copy", null)}
          >
            複製
          </Button>
          {onReply && (
            <Button
              {...storytellerChatActionButtonProps}
              startIcon={<ReplyIcon />}
              onClick={() =>
                onReply({
                  id: message.id,
                  role: message.role,
                  content: message.content,
                  speaker: "AI 助理",
                })
              }
            >
              回覆
            </Button>
          )}
        </Stack>
      )}
    </StorytellerChatBubble>
  );
}

export function StorytellerAgenticPanel({
  targetKind,
  projectPublicId,
  targetPublicId,
  agents,
  currentStory,
  otherStories,
  lores,
  penName,
  onApplyText,
  onApplyProposalToEditor,
  onStoryChanged,
}: {
  // Story／Lore 兩邊共用同一顆面板（同一套工具、同一套 Proposal 機制），差別只在
  // 這個軸線——決定要打哪一組 API（.../stories/:id/... 還是 .../lores/:id/...）、
  // system prompt 的 @thisStory／@thisLore 指向哪一筆。
  targetKind: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
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
  // 提案卡片「套用提案」在提案目標剛好是目前這篇時，把提案欄位填進編輯區並
  // 存一次檔——StoryEditor／LoreEditor 各自實作欄位怎麼對應、怎麼存，這裡只
  // 負責往下傳。沒帶這個 prop（理論上不會發生，兩個呼叫端都有接）就退回
  // StorytellerAgenticProposalCard 原本呼叫後端直接套用的行為。
  onApplyProposalToEditor?: (
    proposal: StorytellerAgenticProposal,
  ) => Promise<void>;
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
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
  const effectiveProvider =
    overriddenApiKey?.provider ?? selectedAgent?.provider;
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

  // Rules of Hooks 不能依 targetKind 條件呼叫其中一組——story／lore 兩組 hook 都
  // 固定呼叫，只把當下不是目標種類那組的 publicId 傳 undefined（hook 內部本來就
  // 靠 publicId 是否存在決定要不要真的送 request），下面再依 targetKind 挑其中
  // 一組的結果來用。
  const runSkillMutationStory = useRunStorytellerAgent(
    projectPublicId,
    targetKind === "story" ? targetPublicId : undefined,
  );
  const runSkillMutationLore = useRunStorytellerLoreAgent(
    projectPublicId,
    targetKind === "lore" ? targetPublicId : undefined,
  );
  const runSkillMutation =
    targetKind === "lore" ? runSkillMutationLore : runSkillMutationStory;
  const runAgenticQueryStory = useRunStorytellerAgenticQuery(
    projectPublicId,
    targetKind === "story" ? targetPublicId : undefined,
  );
  const runAgenticQueryLore = useRunStorytellerLoreAgenticQuery(
    projectPublicId,
    targetKind === "lore" ? targetPublicId : undefined,
  );
  const runAgenticQuery =
    targetKind === "lore" ? runAgenticQueryLore : runAgenticQueryStory;
  const storyMessagesQuery = useStorytellerStoryChatMessages(
    projectPublicId,
    targetKind === "story" ? targetPublicId : undefined,
    skillMessagesPerPage,
  );
  const loreMessagesQuery = useStorytellerLoreChatMessages(
    projectPublicId,
    targetKind === "lore" ? targetPublicId : undefined,
    skillMessagesPerPage,
  );
  const {
    data: skillMessagesPages,
    isLoading: skillMessagesLoading,
    hasNextPage: hasMoreSkillHistory,
    isFetchingNextPage: loadingMoreSkillHistory,
    fetchNextPage: fetchMoreSkillHistory,
  } = targetKind === "lore" ? loreMessagesQuery : storyMessagesQuery;

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
    // skill 指令從不套用 Agent 的人設 prompt（ignore_agent_persona 固定
    // true），agent_id 純粹是技術上用哪個 provider/model 打的細節，不代表
    // 「這句是哪個人設說的」——說話者固定顯示「AI 助理」，跟 agentic 模式
    // 一致，不要秀出可能誤導的 Agent 名稱（見 mode Chip 才是真正該標的資訊）。
    if (message.role === "assistant") {
      return "AI 助理";
    }
    if (message.role === "user") {
      return penName || "使用者";
    }
    return "System";
  }

  // agentic_query 模式的 assistant 訊息會把這輪的 tool_calls 存進 metadata（見
  // 後端 agenticQueryOutputMetadata）；重新載入歷史時要從這裡解析回 steps，畫面
  // 上的「工作軌跡」才不會在切分頁重新掛載後消失。Proposals 不在 metadata 裡，
  // 後端直接把 storyteller_agent_proposals 的最新狀態貼在 message.proposals 上
  // （見 StorytellerStoryChatMessage 的說明），不用另外解析。
  function parseAgenticMetadata(metadata?: string): {
    steps?: StorytellerAgenticStep[];
  } | null {
    if (!metadata) {
      return null;
    }
    try {
      const parsed = JSON.parse(metadata) as {
        steps?: StorytellerAgenticStep[];
      };
      if (!parsed.steps || parsed.steps.length === 0) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // skill 訊息的 user 那則存檔時會把 mode 記進 metadata（見後端
  // agentRunInputMetadata），重新載入歷史時從這裡解析回來，訊息泡泡才標得出
  // 「這則走了哪個 /指令」。assistant 那則的 metadata 是 finish_reason/usage，
  // 沒有 mode 欄位，會安全地回傳 undefined。
  function parseMessageMode(
    metadata?: string,
  ): StorytellerAgentRunMode | undefined {
    if (!metadata) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(metadata) as { mode?: string };
      return parsed.mode as StorytellerAgentRunMode | undefined;
    } catch {
      return undefined;
    }
  }

  const skillHistoryMessages: PanelMessage[] = visibleSkillMessages.map(
    (message) => {
      const agentic = parseAgenticMetadata(message.metadata);
      const hasProposals = (message.proposals?.length ?? 0) > 0;
      if ((agentic || hasProposals) && message.role !== "system") {
        return {
          kind: "agentic",
          sortKey: new Date(message.created_at).getTime(),
          id: String(message.id),
          role: message.role,
          content: message.content,
          steps: agentic?.steps,
          proposals: message.proposals,
          agentName: message.agent_name || undefined,
        };
      }
      return {
        kind: "skill",
        sortKey: new Date(message.created_at).getTime(),
        id: String(message.id),
        role: message.role,
        content: message.content,
        speaker: skillMessageSpeaker(message),
        mode: parseMessageMode(message.metadata),
        // skill 指令從不支援「/rewrite /色文作家」這種串接寫法，一律吃當下
        // chip 選的那個 Agent，等於每一則的 agent_name 都一樣、沒有分辨度，
        // 標了也只是雜訊——只標 mode（走了哪個指令）就夠，不重複標 Agent。
      };
    },
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
      speaker: "AI 助理",
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
  }, [
    combinedMessages.length,
    runSkillMutation.isPending,
    runAgenticQuery.isPending,
  ]);

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
    ? {
        id: replyTarget.id,
        speaker: replyTarget.speaker,
        content: replyTarget.content,
      }
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
    Boolean(targetPublicId) &&
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
      mode,
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
          ignore_agent_persona: true,
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

  function runAgentic(
    instruction: string,
    options?: { agentId?: number; ignoreAgentPersona?: boolean },
  ) {
    const targetAgentId = options?.agentId ?? agentIdNumeric;
    // 跟後端 messageAgentID 的邏輯對齊：沒有明確切換人設（ignoreAgentPersona
    // 為 true，一般打字送出的預設路徑）時不要標 Agent 名稱，不然這輪對話還
    // 沒重新整理、還在畫面上即時顯示的這幾秒，會先秀出當下 chip 選的預設
    // Agent——跟之後從資料庫重新載入、agent_id 是 NULL 算出來的空白狀態對
    // 不上，變成畫面閃一下又消失的假訊號。
    const targetAgentName = options?.ignoreAgentPersona
      ? undefined
      : agents.find((agent) => Number(agent.id) === targetAgentId)?.name;
    const userSortKey = nextSessionSortKey();
    const userMessage: Extract<PanelMessage, { kind: "agentic" }> = {
      kind: "agentic",
      sortKey: userSortKey,
      id: `agentic-user-${userSortKey}`,
      role: "user",
      content: instruction,
      agentName: targetAgentName,
    };
    setAgenticMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    // 回覆摘要只該陪著這一次送出的內容，訊息本身已經把 replyReferenceTarget
    // 組進 instruction 裡了（見兩個呼叫端都用 composeStorytellerAgentInstructionWithReply）
    // ——送出後就該清空，不然使用者送完下一則訊息時，輸入框上方還會一直卡著
    // 上一次回覆的摘要，跟這次送出的內容完全對不上。
    setReplyTarget(null);

    runAgenticQuery.mutate(
      {
        agentId: targetAgentId,
        input: {
          user_prompt: instruction,
          ignore_agent_persona: options?.ignoreAgentPersona ?? false,
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
              agentName: targetAgentName,
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
    // /<Agent 名稱> 只影響「這一則」訊息要用哪個 Agent——解析完直接連同剩下的指令
    // 內容一起送出，不寫回任何持久 state，下一則沒有前綴的訊息不會被這次切換影響
    // （見 feedback：色文作家等一次性人設不該無聲沿用到後續不相關的對話）。
    const agentSwitch = matchAgentNameCommand(trimmed, agents);
    if (agentSwitch) {
      const instruction = agentSwitch.instruction.trim();
      if (!instruction) {
        // 只打了 /Agent 名稱、後面還沒接指令內容——先把前綴吃掉讓使用者繼續打字，
        // 不強迫送出空白訊息。
        setPrompt("");
        return;
      }
      const targetAgent = agents.find(
        (agent) => agent.id === agentSwitch.agentId,
      );
      const targetAgentId = Number(agentSwitch.agentId);
      if (
        !hasAnyApiKey ||
        !projectPublicId ||
        !targetPublicId ||
        !Number.isFinite(targetAgentId) ||
        !targetAgent?.enabled ||
        payloadError !== "" ||
        pending
      ) {
        return;
      }
      runAgentic(
        composeStorytellerAgentInstructionWithReply(
          instruction,
          replyReferenceTarget,
        ),
        { agentId: targetAgentId, ignoreAgentPersona: false },
      );
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
    runAgentic(
      composeStorytellerAgentInstructionWithReply(
        trimmed,
        replyReferenceTarget,
      ),
      { ignoreAgentPersona: true },
    );
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
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 120 }}
            >
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
              {agents.length === 0 ? "尚未建立 Agent" : "未選擇人設"}
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
              {agents.length > 0 && (
                <MenuItem selected onClick={() => setAgentMenuAnchor(null)}>
                  未選擇
                </MenuItem>
              )}
              {agents.map((agent) => (
                <MenuItem
                  key={agent.id}
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
          {!targetPublicId && (
            <Alert severity="info" variant="outlined">
              {targetKind === "lore"
                ? "新設定集第一次存檔後才能使用 AI 助理。"
                : "新故事第一次存檔後才能使用 AI 助理。"}
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
                    targetKind={targetKind}
                    projectPublicId={projectPublicId}
                    targetPublicId={targetPublicId}
                    otherStories={otherStories}
                    lores={lores}
                  />
                ) : (
                  <AgenticAssistantMessage
                    key={message.id}
                    message={message}
                    targetKind={targetKind}
                    projectPublicId={projectPublicId}
                    targetPublicId={targetPublicId}
                    otherStories={otherStories}
                    lores={lores}
                    currentStory={currentStory}
                    onStoryChanged={onStoryChanged}
                    onApplyText={onApplyText}
                    onApplyProposalToEditor={onApplyProposalToEditor}
                    onReply={handleReply}
                    isReplyTarget={replyTarget?.id === message.id}
                  />
                ),
              )}
              {runSkillMutation.isPending && (
                <StorytellerAgentMessage
                  message={{
                    id: "skill-pending-loading",
                    role: "assistant",
                    content: "",
                    speaker: "AI 助理",
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
                  targetKind={targetKind}
                  projectPublicId={projectPublicId}
                  targetPublicId={targetPublicId}
                  otherStories={otherStories}
                  lores={lores}
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
          <Box sx={{ position: "relative" }}>
            <TextField
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              inputRef={promptTextareaRef}
              label="輸入需求"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：幫我把這段開頭改得更懸疑一點；或輸入 /rewrite 更懸疑一點 觸發單輪改寫。"
              error={Boolean(payloadError)}
              helperText={payloadError || SKILL_SLASH_COMMAND_HINT}
              sx={{
                "& .MuiInputBase-input": {
                  color: "transparent",
                  caretColor: (theme) => theme.palette.text.primary,
                  "&::placeholder": {
                    color: "text.secondary",
                    opacity: 1,
                  },
                },
              }}
            />
            <StorytellerPromptHighlightOverlay
              text={prompt}
              textareaRef={promptTextareaRef}
            />
          </Box>
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
                    onChange={(event) =>
                      setCustomModelInput(event.target.value)
                    }
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
              指令 / 引用說明
            </Button>
          </Stack>
          {promptReferences.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {promptReferences.map((reference) => (
                <Chip
                  key={reference.token}
                  size="small"
                  color={
                    reference.token === "@thisStory" ? "primary" : "default"
                  }
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
                    setPrompt((current) =>
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {loreMentionOptions.map((item) => (
                <Button
                  key={item.id}
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setPrompt((current) =>
                      insertLoreMention(current, item.title),
                    )
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
        agents={agents}
      />
    </Paper>
  );
}
