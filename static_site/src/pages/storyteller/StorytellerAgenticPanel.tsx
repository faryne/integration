import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ReplayIcon from "@mui/icons-material/Replay";
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
  Divider,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useStorytellerUserProfile } from "@/apis/storyteller.ts";
import {
  fetchStorytellerAgenticChat,
  useStorytellerAgenticReferenceContent,
  useStorytellerAgentProviderModels,
  useStorytellerLoreChatMessages,
  useStorytellerProviderAPIKeys,
  useStorytellerStoryChatMessages,
  useResendStorytellerAgent,
  useSubmitStorytellerAgent,
} from "@/apis/storyteller/agent.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  STORYTELLER_ASSISTANT_AVATAR_SRC,
  normalizeStorytellerAssistantExpression,
  storytellerAssistantAvatarSrc,
  storytellerMascotSrc,
} from "@/helpers/storytellerMascot.ts";
import { storytellerUserAvatarSrc } from "@/helpers/storytellerUser.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { StorytellerAIQuickActions } from "@/pages/storyteller/StorytellerAIQuickActions.tsx";
import { StorytellerMarkdownSyntaxDrawer } from "@/pages/storyteller/StorytellerMarkdownSyntaxDrawer.tsx";
import { StorytellerAgentReferenceDrawer } from "@/pages/storyteller/StorytellerAgentReferenceDrawer.tsx";
import { StorytellerPromptHighlightOverlay } from "@/pages/storyteller/StorytellerPromptHighlightOverlay.tsx";
import { SelfHostedModelPicker } from "@/pages/storyteller/SelfHostedModelPicker.tsx";
import {
  StorytellerAgentLoadingState,
  StorytellerAgentMessage,
  StorytellerChatBubble,
  storytellerChatActionButtonProps,
  type StorytellerAgentPanelAgent,
  type StorytellerAgentPanelMessage,
  type StorytellerAgentApplyAction,
  type StorytellerAgentPanelSelection,
} from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import type { StorytellerAgenticCurrentStory } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import {
  StorytellerAgenticProposalCard,
  proposalActionLabel,
} from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import {
  buildStorytellerAgentMessageLinks,
  buildStorytellerAgentProposalRejectionQuote,
  buildStorytellerAgentProposalReferenceContent,
  buildStorytellerAgentReplyQuote,
  composeStorytellerAgentInstructionWithProposalRejection,
  composeStorytellerAgentInstructionWithReply,
  resolveStorytellerAgentReferences,
  toStorytellerAgentRunReferences,
  summarizeStorytellerAgentProposalArguments,
  type StorytellerAgentReplyTarget,
} from "@/pages/storyteller/storytellerAgentReferences.ts";
import {
  currentLoreMentionQuery,
  currentStoryMentionQuery,
  insertLoreMention,
  insertStoryMention,
} from "@/pages/storyteller/storytellerAgentEditing.ts";
import {
  STORYTELLER_AI_SCOPE_LABELS,
  truncateStorytellerSelectionPreview,
  type StorytellerSelectionAgentTrigger,
} from "@/pages/storyteller/storytellerSelectionAgentTrigger.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunUsage,
  StorytellerAssistantExpression,
  StorytellerAgenticProposal,
  StorytellerAgenticReplyReferenceRequest,
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
  custom: "custom_selection",
};
const SELECTION_AGENT_SLASH_WORDS: Partial<
  Record<StorytellerAgentRunMode, string>
> = {
  rewrite_selection: "rewrite",
  expand_selection: "expand",
  translate_selection: "translate",
  custom_selection: "custom",
};
const SKILL_SLASH_COMMAND_HINT =
  "打 / 可觸發單輪 skill 或切換人設；完整說明見「指令 / 引用說明」。";
const STORYTELLER_ASSISTANT_NAME = "梭梭";

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
): { agentId: string; nameLength: number; instruction: string } | null {
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
  return best;
}

// 輸入框高亮疊層要跟 handleSend() 實際送出時的判斷邏輯一致（Agent 名稱優先、
// skill 指令次之），只有真的會被辨識成指令的前綴才上色，避免 /fuck 這種打錯
// 或亂打的字也被誤標成「這是合法指令」。
function recognizedSlashCommandPrefixLength(
  value: string,
  agents: StorytellerAgentPanelAgent[],
): number {
  if (!value.startsWith("/")) {
    return 0;
  }
  const agentMatch = matchAgentNameCommand(value, agents);
  if (agentMatch) {
    return 1 + agentMatch.nameLength;
  }
  const skillMatch = value.match(/^\/(\S+)/);
  if (skillMatch && SKILL_SLASH_COMMANDS[skillMatch[1].toLowerCase()]) {
    return skillMatch[0].length;
  }
  return 0;
}

const skillMessagesPerPage = 10;
const skillInstructionMaxCharacters = 4000;
const skillFullContentMaxCharacters = 60000;
const skillTotalPayloadMaxCharacters = 80000;

const storytellerAgentApiKeyStorageKey = "storyteller-agent-api-key-id";
const storytellerAgentModelStorageKey = "storyteller-agent-model-name";

function buildAgenticMessageReplyReference(
  reply: StorytellerAgentReplyTarget | null | undefined,
): StorytellerAgenticReplyReferenceRequest | undefined {
  if (!reply || reply.content.trim() === "") {
    return undefined;
  }
  const messageID = Number(reply.id);
  if (!Number.isInteger(messageID) || messageID <= 0) {
    return undefined;
  }
  return {
    kind: "message",
    message_id: messageID,
    summary: buildStorytellerAgentReplyQuote(reply),
  };
}

// 沿用既有 StoryEditor.tsx 的 aiErrorMessage() 邏輯：後端錯誤訊息在
// response.data.message，axios 預設的 "Request failed with status code
// 503" 對使用者沒有意義。
function agenticErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ECONNABORTED"
  ) {
    return "等待 AI 助理逾時，伺服器可能仍在處理；請稍後重新整理狀態，再決定是否重送。";
  }
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
// 用 kind 分流。顯示順序完全交給陣列位置決定（歷史訊息本來就照時間排好，
// session 訊息照送出/收到順序 push），不額外算排序鍵。
type PanelMessage =
  | ({ kind: "skill" } & StorytellerAgentPanelMessage)
  | {
      kind: "agentic";
      id: string;
      role: "user" | "assistant";
      content: string;
      expression?: StorytellerAssistantExpression;
      steps?: StorytellerAgenticStep[];
      proposals?: StorytellerAgenticProposal[];
      // 新資料只存參照；replyContent 只給舊 metadata.reply_content 或極短暫拿不到
      // DB id 的本地訊息當 fallback，避免舊資料或 session 中間態整則壞掉。
      replyReference?: StorytellerAgenticReplyReferenceRequest;
      replyContent?: string;
      usage?: { total_tokens?: number };
      warning?: string;
      isLoading?: boolean;
      // chatStatus="in_progress" 代表 provider 仍在處理；"pending" 才代表這則
      // user 訊息沒有拿到 AI 回覆、可以重送。
      chatId?: number;
      chatStatus?: "pending" | "in_progress" | "completed";
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

function parseExpandableAgenticQuote(
  content: string,
  replyReference?: StorytellerAgenticReplyReferenceRequest,
  fallbackContent?: string,
): {
  quote: string;
  body: string;
  replyReference?: StorytellerAgenticReplyReferenceRequest;
  fallbackContent?: string;
} | null {
  const hasReference =
    (replyReference?.kind === "message" &&
      Boolean(replyReference.message_id)) ||
    (replyReference?.kind === "proposal" &&
      Boolean(replyReference.proposal_public_id));
  if (!hasReference && !fallbackContent?.trim()) {
    return null;
  }
  const match = content.match(/^(> (?:回覆 .+|否決提案 #\d+：.+))(?:\r?\n|$)/);
  if (!match) {
    return null;
  }
  return {
    quote: match[1].replace(/^>\s*/, ""),
    body: content.slice(match[0].length).replace(/^\r?\n/, ""),
    replyReference,
    fallbackContent,
  };
}

function AgenticExpandableQuote({
  quote,
  body,
  replyReference,
  fallbackContent,
  isUser,
  linkedBody,
  loadReferenceContent,
}: {
  quote: string;
  body: string;
  replyReference?: StorytellerAgenticReplyReferenceRequest;
  fallbackContent?: string;
  isUser: boolean;
  linkedBody: string;
  loadReferenceContent: (
    reference: StorytellerAgenticReplyReferenceRequest,
  ) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(fallbackContent ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function toggleExpanded() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (content.trim() !== "" || !replyReference) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const loaded = await loadReferenceContent(replyReference);
      if (loaded.trim() === "") {
        setErrorMessage("找不到原始內容，可能已被刪除或沒有權限讀取。");
      }
      setContent(loaded);
    } catch {
      setErrorMessage("找不到原始內容，可能已被刪除或沒有權限讀取。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Box
        component="blockquote"
        sx={{
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          sx={{
            cursor: "pointer",
            borderRadius: 0.5,
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: isUser ? "primary.contrastText" : "primary.main",
              outlineOffset: 2,
            },
            "&:hover": {
              bgcolor: isUser ? "rgba(255,255,255,0.08)" : "action.hover",
            },
          }}
          onClick={() => void toggleExpanded()}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }
            event.preventDefault();
            void toggleExpanded();
          }}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              flex: "0 0 auto",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
          <Typography variant="body2" sx={{ minWidth: 0 }}>
            {quote}
          </Typography>
        </Stack>
        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 0.75,
              pt: 0.75,
              borderTop: "1px solid",
              borderColor: isUser ? "rgba(255,255,255,0.28)" : "divider",
            }}
          >
            <Typography
              variant="caption"
              component="div"
              sx={{ mb: 0.5, opacity: 0.78 }}
            >
              完整引用內容
            </Typography>
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption">正在載入引用內容...</Typography>
              </Stack>
            ) : errorMessage ? (
              <Alert severity="warning" variant="outlined">
                {errorMessage}
              </Alert>
            ) : (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  maxHeight: 260,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  fontFamily: "inherit",
                  fontSize: "0.8125rem",
                  lineHeight: 1.65,
                }}
              >
                {content}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
      {body.trim() !== "" && (
        <StorytellerMarkdown>{linkedBody}</StorytellerMarkdown>
      )}
    </>
  );
}

function AgenticAssistantMessage({
  message,
  userAvatarSrc,
  userAvatarFallback,
  targetKind,
  projectPublicId,
  targetPublicId,
  otherStories,
  lores,
  currentStory,
  onStoryChanged,
  onApplyText,
  onApplyProposalToEditor,
  hasUnsavedChanges,
  onSaveBeforeApply,
  onRejectProposalWithFeedback,
  onReply,
  isReplyTarget,
  onResend,
  resendingChatId,
}: {
  message: Extract<PanelMessage, { kind: "agentic" }>;
  userAvatarSrc?: string;
  userAvatarFallback: string;
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
  hasUnsavedChanges?: () => boolean;
  onSaveBeforeApply?: () => Promise<number | null>;
  onRejectProposalWithFeedback?: (
    proposal: StorytellerAgenticProposal,
    feedback: string,
    proposalIndex: number,
  ) => void;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  isReplyTarget?: boolean;
  onResend?: (chatId: number) => void;
  resendingChatId?: number | null;
}) {
  const isUser = message.role === "user";
  const canApply =
    !isUser && !message.isLoading && message.content.trim() !== "";
  // 只有 pending 才代表「已經失敗或中斷，可以重送」；in_progress 是正常處理中，
  // 不能把它當成錯誤，否則背景 refetch 會在長請求還沒完成時誤導使用者。
  const resendable =
    isUser && message.chatId !== undefined && message.chatStatus === "pending";
  const resending = resendable && resendingChatId === message.chatId;
  const referenceContent = useStorytellerAgenticReferenceContent(
    targetKind,
    projectPublicId,
    targetPublicId,
  );
  const linkedContent = buildStorytellerAgentMessageLinks(message.content, {
    targetKind,
    projectPublicId,
    targetPublicId,
    otherStories,
    lores,
  });
  const expandableQuote = isUser
    ? parseExpandableAgenticQuote(
        message.content,
        message.replyReference,
        message.replyContent,
      )
    : null;
  const linkedBody = expandableQuote
    ? buildStorytellerAgentMessageLinks(expandableQuote.body, {
        targetKind,
        projectPublicId,
        targetPublicId,
        otherStories,
        lores,
      })
    : "";
  return (
    <StorytellerChatBubble
      messageId={message.id}
      isUser={isUser}
      isReplyTarget={isReplyTarget}
      speaker={isUser ? "你" : STORYTELLER_ASSISTANT_NAME}
      avatarSrc={
        isUser
          ? userAvatarSrc
          : storytellerAssistantAvatarSrc(message.expression)
      }
      avatarFallbackSrc={isUser ? undefined : STORYTELLER_ASSISTANT_AVATAR_SRC}
      avatarAlt={isUser ? "使用者頭像" : "梭梭頭像"}
      avatarFallback={isUser ? userAvatarFallback : "梭"}
      hideAvatar={message.isLoading}
    >
      {message.isLoading ? (
        <StorytellerAgentLoadingState />
      ) : (
        message.content && (
          <Box sx={{ typography: "body2", mt: 0.5 }}>
            {expandableQuote ? (
              <AgenticExpandableQuote
                quote={expandableQuote.quote}
                body={expandableQuote.body}
                replyReference={expandableQuote.replyReference}
                fallbackContent={expandableQuote.fallbackContent}
                isUser={isUser}
                linkedBody={linkedBody}
                loadReferenceContent={async (reference) =>
                  (await referenceContent.mutateAsync(reference)).content
                }
              />
            ) : (
              <StorytellerMarkdown>{linkedContent}</StorytellerMarkdown>
            )}
          </Box>
        )
      )}
      {message.warning && (
        <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
          {message.warning}
        </Alert>
      )}
      {resendable && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Alert severity="warning" variant="outlined">
            沒有拿到 AI 回覆（可能是連線問題或伺服器中斷），可以重送一次。
          </Alert>
          {resendable && onResend && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={
                resending ? <CircularProgress size={14} /> : <ReplayIcon />
              }
              disabled={resending}
              onClick={() => onResend(message.chatId!)}
              sx={{ alignSelf: "flex-start" }}
            >
              {resending ? "重送中" : "重送"}
            </Button>
          )}
        </Stack>
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
              hasUnsavedChanges={hasUnsavedChanges}
              onSaveBeforeApply={onSaveBeforeApply}
              onRejectedWithFeedback={onRejectProposalWithFeedback}
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
            onClick={() => onApplyText(message.content, "append", null)}
          >
            附加末尾
          </Button>
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
                  speaker: STORYTELLER_ASSISTANT_NAME,
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
  hasUnsavedChanges,
  onSaveBeforeApply,
  onStoryChanged,
  pendingSelectionAgentTrigger,
  presentation = "inline",
  onClose,
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
  // 提案目標是目前這篇、而編輯區有未存檔變更時，卡片要先存檔再套用（見
  // StorytellerAgenticProposalCard）。onSaveBeforeApply 回傳存檔後的版本 id，
  // 失敗時是 null。
  hasUnsavedChanges?: () => boolean;
  onSaveBeforeApply?: () => Promise<number | null>;
  onStoryChanged?: () => void;
  pendingSelectionAgentTrigger?: StorytellerSelectionAgentTrigger | null;
  // Drawer 與主畫布工作區都由外層決定可用高度，面板本身填滿該空間。
  presentation?: "inline" | "floatingDock" | "workspace";
  onClose?: () => void;
}) {
  const { appearance } = useStorytellerAppearance();
  const floatingDock = presentation === "floatingDock";
  const workspace = presentation === "workspace";
  const fillAvailableHeight = floatingDock || workspace;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const compactComposer = fillAvailableHeight && isMobile;
  const { session, user } = useAuth();
  const { data: userProfile } = useStorytellerUserProfile();
  const defaultUserAvatar = session?.user.photo_url ?? user?.photoURL ?? "";
  const userAvatarSrc = storytellerUserAvatarSrc(
    userProfile,
    defaultUserAvatar,
  );
  const userAvatarFallback =
    (penName || session?.user.display_name || user?.displayName || "你")
      .trim()
      .charAt(0) || "你";
  const queryClient = useQueryClient();
  // 沒有「目前選中的 Agent」：人設只影響單次 prompt，以 /<名稱> 前綴表示（chip 只是在輸入框
  // 插入這段前綴的捷徑），送出時明確帶 persona_agent_id；沒有前綴就沒有人設。
  const [prompt, setPrompt] = useState("");
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 輸入框文字預設是透明的（真正可見的是下面的 highlight overlay），但注音等
  // IME 組字階段的候選底線是瀏覽器畫在「這顆真正的 textarea」上的原生效果，
  // 文字透明會連底線一起看不見。組字中先讓真正文字變回可見、把 overlay 藏起來
  // （避免兩層文字疊字），放開選字後再切回預設——組字視覺完全交給瀏覽器原生
  // 處理，不用自己刻一套。
  const [isComposingPrompt, setIsComposingPrompt] = useState(false);
  const [promptSelection, setPromptSelection] = useState({
    start: 0,
    end: 0,
  });
  // 金鑰／模型是使用者跨 project 的操作習慣，不屬於任何故事內容，記在
  // localStorage（不動後端）；重新整理後先拿上次選的當候選，實際有沒有效
  // 還是交給下面既有的 fallback effect 驗證（key 被刪除、model 不在目前
  // provider 清單裡都會自動退回清單第一筆，不會照單全收壞掉的殘留值）。
  const [providerApiKeyId, setProviderApiKeyId] = useState(
    () => window.localStorage.getItem(storytellerAgentApiKeyStorageKey) ?? "",
  );
  const [modelNameOverride, setModelNameOverride] = useState(
    () => window.localStorage.getItem(storytellerAgentModelStorageKey) ?? "",
  );
  useEffect(() => {
    if (providerApiKeyId) {
      window.localStorage.setItem(
        storytellerAgentApiKeyStorageKey,
        providerApiKeyId,
      );
    } else {
      window.localStorage.removeItem(storytellerAgentApiKeyStorageKey);
    }
  }, [providerApiKeyId]);
  useEffect(() => {
    if (modelNameOverride) {
      window.localStorage.setItem(
        storytellerAgentModelStorageKey,
        modelNameOverride,
      );
    } else {
      window.localStorage.removeItem(storytellerAgentModelStorageKey);
    }
  }, [modelNameOverride]);
  const [aiConfigMenuAnchor, setAiConfigMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [agentMenuAnchor, setAgentMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [replyTarget, setReplyTarget] =
    useState<StorytellerAgentPanelMessage | null>(null);
  const [selectionAgentTarget, setSelectionAgentTarget] = useState<{
    selectedText: string;
    scope: "selection" | "block";
  } | null>(null);
  // 這次對話 session 內所有還沒被歷史清單取代的訊息（skill 的樂觀訊息/loading/
  // 結果、agentic 的使用者訊息/loading/回覆/錯誤），一律照送出或收到的順序直接
  // push 進這一個陣列——顯示順序只看陣列位置，不再用另外一組排序鍵去跟歷史訊息
  // 的真實時間戳比大小。要更新某一則（例如 loading 換成正式結果）用 id 對應、
  // 原地替換，絕不用「濾掉舊的、把新的接到陣列尾端」，否則等於重新排到最後面。
  const [liveMessages, setLiveMessages] = useState<PanelMessage[]>([]);
  function pushLiveMessage(message: PanelMessage) {
    setLiveMessages((prev) => [...prev, message]);
  }
  function replaceLiveMessage(id: string, next: PanelMessage) {
    setLiveMessages((prev) => prev.map((m) => (m.id === id ? next : m)));
  }
  function removeLiveMessage(id: string) {
    setLiveMessages((prev) => prev.filter((m) => m.id !== id));
  }
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingSkillIdRef = useRef(0);
  const pendingAgenticIdRef = useRef(0);
  const [referenceDrawerOpen, setReferenceDrawerOpen] = useState(false);

  const promptAgentSwitch = matchAgentNameCommand(prompt.trimStart(), agents);
  const promptAgent = promptAgentSwitch
    ? agents.find((agent) => agent.id === promptAgentSwitch.agentId)
    : undefined;

  const { data: providerApiKeys = [], isLoading: providerApiKeysLoading } =
    useStorytellerProviderAPIKeys();
  const { data: providerModelsList = [] } = useStorytellerAgentProviderModels();
  // 换 key 可以跨 provider（見 Agent／provider/key/model 解耦），所以這裡不再
  // 依 provider 篩選——任何一把已設定的 key 都能拿來跑。
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
  // 實際生效的 provider：一定看目前選的 key（上面那個 effect 保證只要有 key 就一定選了一把）。
  const effectiveProvider = overriddenApiKey?.provider;
  const effectiveProviderModelInfo = providerModelsList.find(
    (entry) => entry.provider === effectiveProvider,
  );
  const effectiveProviderLabel =
    effectiveProviderModelInfo?.label ?? effectiveProvider ?? "未選 Provider";
  const effectiveModelLabel = modelNameOverride || "未選 Model";
  const modelOptions = effectiveProviderModelInfo?.models ?? [];
  // self_hosted／openrouter 這類 provider 沒有固定模型清單（models 可能是空的），
  // 改成讓使用者直接輸入模型名稱，而不是完全選不了。
  const providerAllowsCustomModel = Boolean(
    effectiveProviderModelInfo?.allow_custom_model,
  );
  const usesSelfHostedModelPicker =
    effectiveProvider === "self_hosted" &&
    providerAllowsCustomModel &&
    modelOptions.length === 0;
  const [customModelInput, setCustomModelInput] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const normalizedModelFilter = modelFilter.trim().toLowerCase();
  const filteredModelOptions = normalizedModelFilter
    ? modelOptions.filter((model) =>
        `${model.label ?? ""} ${model.name}`
          .toLowerCase()
          .includes(normalizedModelFilter),
      )
    : modelOptions;

  useEffect(() => setModelFilter(""), [effectiveProvider]);

  function closeAiConfigMenu() {
    setAiConfigMenuAnchor(null);
    setModelFilter("");
  }

  useEffect(() => {
    if (!pendingSelectionAgentTrigger) {
      return;
    }
    if (pendingSelectionAgentTrigger.scope === "document") {
      setSelectionAgentTarget(null);
      setPrompt("");
      setPromptSelection({ start: 0, end: 0 });
      window.requestAnimationFrame(() => promptTextareaRef.current?.focus());
      return;
    }
    const word =
      SELECTION_AGENT_SLASH_WORDS[pendingSelectionAgentTrigger.mode] ??
      "custom";
    const instruction = pendingSelectionAgentTrigger.instruction.trim();
    const nextPrompt = `/${word}${instruction ? ` ${instruction}` : ""}`;
    const selectedText = pendingSelectionAgentTrigger.selectedText.trim();
    setSelectionAgentTarget(
      selectedText
        ? {
            selectedText: pendingSelectionAgentTrigger.selectedText,
            scope: pendingSelectionAgentTrigger.scope ?? "selection",
          }
        : null,
    );
    setPrompt(nextPrompt);
    setPromptSelection({
      start: nextPrompt.length,
      end: nextPrompt.length,
    });
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
      promptTextareaRef.current?.setSelectionRange(
        nextPrompt.length,
        nextPrompt.length,
      );
    });
  }, [pendingSelectionAgentTrigger]);

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

  // 一般對話與 skill 共用同一個送出 hook（差別只在請求體的 skill 欄位），各自一個 instance
  // 是為了讓兩邊的 isPending／error 狀態互不干擾；故事／設定集只差 targetKind。
  const runSkillMutation = useSubmitStorytellerAgent(
    projectPublicId,
    targetKind,
    targetPublicId,
  );
  const runAgenticQuery = useSubmitStorytellerAgent(
    projectPublicId,
    targetKind,
    targetPublicId,
  );
  const resendAgenticQuery = useResendStorytellerAgent(targetKind);
  // 重送同時只讓一則生效，用 chatId 記正在跑哪一則——按鈕的 loading/disabled
  // 狀態靠這個判斷，不用另外幫每則訊息包一份 mutation 狀態。
  const [resendingChatId, setResendingChatId] = useState<number | null>(null);
  const [resendError, setResendError] = useState("");
  const [modelAppliedSnack, setModelAppliedSnack] = useState("");
  function handleResend(chatId: number) {
    if (resendingChatId !== null || !providerApiKeyId || !modelNameOverride) {
      return;
    }
    setResendingChatId(chatId);
    resendAgenticQuery.mutate(
      {
        chatId,
        input: {
          task: "",
          provider_apikey_id: Number(providerApiKeyId),
          model_name: modelNameOverride,
        },
      },
      {
        onError: (error) => setResendError(agenticErrorMessage(error)),
        onSettled: () => setResendingChatId(null),
      },
    );
  }
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
  // liveMessages 裡這次執行剛拿到、尚未確定已經進到（invalidate 後重新抓取的）
  // 歷史清單裡的 skill 結果；一旦歷史清單也出現同樣內容，代表已經是「正式」的
  // 那一則，這裡先濾掉暫時結果對應的那筆，避免同一則回應顯示兩次。
  const liveSkillAssistantContents = new Set(
    liveMessages
      .filter(
        (message) =>
          message.kind === "skill" &&
          message.role === "assistant" &&
          message.content.trim() !== "",
      )
      .map((message) => message.content.trim()),
  );
  const visibleSkillMessages = rawSkillMessages.filter(
    (message) =>
      !(
        message.role === "assistant" &&
        liveSkillAssistantContents.has(message.content.trim())
      ),
  );

  function skillMessageSpeaker(message: StorytellerStoryChatMessage) {
    // 回覆者固定顯示梭梭；實際使用的 skill／人設由 mode Chip 標示。
    if (message.role === "assistant") {
      return STORYTELLER_ASSISTANT_NAME;
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

  // reply_reference 跟 steps 是不同用途：steps 可為空但回覆參照仍然存在，所以不能
  // 透過 parseAgenticMetadata 讀，不然純問答回覆會因 steps 空陣列被一起丟掉。
  // 舊資料可能仍是 reply_content 快照，保留成 fallback，避免舊訊息展開壞掉。
  function parseAgenticReplyReference(metadata?: string): {
    replyReference?: StorytellerAgenticReplyReferenceRequest;
    replyContent?: string;
  } {
    if (!metadata) {
      return {};
    }
    try {
      const parsed = JSON.parse(metadata) as {
        reply_content?: unknown;
        reply_reference?: {
          kind?: unknown;
          message_id?: unknown;
          proposal_public_id?: unknown;
          summary?: unknown;
        };
      };
      const ref = parsed.reply_reference;
      const replyReference =
        ref?.kind === "message" && typeof ref.message_id === "number"
          ? ({
              kind: "message",
              message_id: ref.message_id,
              summary:
                typeof ref.summary === "string" ? ref.summary : undefined,
            } satisfies StorytellerAgenticReplyReferenceRequest)
          : ref?.kind === "proposal" &&
              typeof ref.proposal_public_id === "string"
            ? ({
                kind: "proposal",
                proposal_public_id: ref.proposal_public_id,
                summary:
                  typeof ref.summary === "string" ? ref.summary : undefined,
              } satisfies StorytellerAgenticReplyReferenceRequest)
            : undefined;
      return {
        replyReference,
        replyContent:
          typeof parsed.reply_content === "string" &&
          parsed.reply_content.trim() !== ""
            ? parsed.reply_content
            : undefined,
      };
    } catch {
      return {};
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

  function parseMessageUsage(
    metadata?: string,
  ): StorytellerAgentRunUsage | undefined {
    if (!metadata) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(metadata) as {
        usage?: StorytellerAgentRunUsage;
      };
      return parsed.usage?.total_tokens ? parsed.usage : undefined;
    } catch {
      return undefined;
    }
  }

  function parseMessageExpression(
    metadata?: string,
  ): StorytellerAssistantExpression {
    if (!metadata) {
      return "neutral";
    }
    try {
      const parsed = JSON.parse(metadata) as { expression?: unknown };
      return normalizeStorytellerAssistantExpression(parsed.expression);
    } catch {
      return "neutral";
    }
  }

  function parseMessageSelectedContent(metadata?: string): string | undefined {
    if (!metadata) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(metadata) as { selected_content?: string };
      const selected = parsed.selected_content;
      return selected && selected.trim() !== "" ? selected : undefined;
    } catch {
      return undefined;
    }
  }

  function skillSelectedContentQuote(selectedContent: string): string {
    const selected = selectedContent.trim();
    return selected ? `> ${selected.replace(/\n/g, "\n> ")}` : "";
  }

  function stripSkillSelectedContentQuote(
    content: string,
    selectedContent?: string,
  ): string {
    if (!selectedContent) {
      return content;
    }
    const quote = skillSelectedContentQuote(selectedContent);
    if (!quote) {
      return content;
    }
    if (content === quote) {
      return "";
    }
    const prefix = `${quote}\n\n`;
    return content.startsWith(prefix) ? content.slice(prefix.length) : content;
  }

  // agentic_query 模式的 mode 值（"agentic_query"）跟 skill 模式那組
  // StorytellerAgentRunMode 是完全不同的字串空間，故意不共用 parseMessageMode
  // 的回傳型別，避免混進 skill 那組列舉裡。
  function isAgenticQueryMode(metadata?: string): boolean {
    if (!metadata) {
      return false;
    }
    try {
      const parsed = JSON.parse(metadata) as { mode?: string };
      return parsed.mode === "agentic_query";
    } catch {
      return false;
    }
  }

  function agenticPanelMessageFromChatRow(
    message: StorytellerStoryChatMessage,
  ): Extract<PanelMessage, { kind: "agentic" }> {
    const agentic = parseAgenticMetadata(message.metadata);
    const reply = parseAgenticReplyReference(message.metadata);
    return {
      kind: "agentic",
      id: String(message.id),
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      expression: parseMessageExpression(message.metadata),
      steps: agentic?.steps,
      proposals: message.proposals,
      replyReference: reply.replyReference,
      replyContent: reply.replyContent,
      usage: parseMessageUsage(message.metadata),
      chatId: message.chat_id,
      chatStatus: message.chat_status,
    };
  }

  // 判斷是不是 agentic 對話不能只看「metadata 有沒有 steps」——純問答沒呼叫
  // 工具時 steps 是空陣列，只存了問題還沒拿到回覆的孤兒訊息更是連 steps 這個
  // 欄位都不存在，兩種都會被誤判成 skill 模式。後端現在 user／assistant 兩則
  // 訊息都會標 mode:"agentic_query"（見 agenticQueryUserMessageMetadata），
  // 用這個當主要依據，hasProposals 留著當保險。skill 現在也走背景執行＋輪詢，
  // 歷史清單重新整理跟 polling 換回正式內容都要用同一套判斷、同一份轉換
  // 邏輯，不要各刻一份，不然兩邊分流的判斷準則遲早會兜不起來。
  function panelMessageFromChatRow(
    message: StorytellerStoryChatMessage,
  ): PanelMessage {
    const hasProposals = (message.proposals?.length ?? 0) > 0;
    const isAgentic = isAgenticQueryMode(message.metadata) || hasProposals;
    if (isAgentic && message.role !== "system") {
      return agenticPanelMessageFromChatRow(message);
    }
    const selectedContent = parseMessageSelectedContent(message.metadata);
    return {
      kind: "skill",
      id: String(message.id),
      role: message.role,
      content: stripSkillSelectedContentQuote(message.content, selectedContent),
      speaker: skillMessageSpeaker(message),
      expression: parseMessageExpression(message.metadata),
      mode: parseMessageMode(message.metadata),
      selectedContent,
      usage: parseMessageUsage(message.metadata),
      chatId: message.chat_id,
      chatStatus: message.chat_status,
    };
  }

  const skillHistoryMessages: PanelMessage[] = visibleSkillMessages.map(
    panelMessageFromChatRow,
  );

  // liveMessages（這次 session 內即時送出、還留著的本地狀態）跟
  // skillHistoryMessages（背景隨時可能重新抓回來的 DB 資料）之間完全獨立，
  // 沒有互相知道對方存在——一旦某輪對話的 chat_id 兩邊都有（送出當下就先
  // 落地問題，見 CreateInProgressChatWithUserMessage），任何背景重新整理都會讓
  // 同一輪對話重複顯示兩次。skill 現在也走背景執行，跟 agentic 對話一樣會撞到
  // 這個問題，兩種 kind 都要用 chat_id 把歷史清單裡「本地已經有更新狀態」的
  // 那幾筆過濾掉，本地狀態優先。送出中的本地 user 訊息在 response 回來前還
  // 沒有 chat_id，所以同時用「同 kind + 內容」擋掉背景 refetch 帶回來的同一則
  // in_progress user row。
  const liveChatIds = new Set(
    liveMessages
      .map((message) => message.chatId)
      .filter((chatId): chatId is number => chatId !== undefined),
  );
  const livePendingUserContentsByKind = {
    skill: new Set(
      liveMessages
        .filter(
          (message) =>
            message.kind === "skill" &&
            message.role === "user" &&
            message.chatId === undefined &&
            message.content.trim() !== "",
        )
        .map((message) => message.content.trim()),
    ),
    agentic: new Set(
      liveMessages
        .filter(
          (message) =>
            message.kind === "agentic" &&
            message.role === "user" &&
            message.chatId === undefined &&
            message.content.trim() !== "",
        )
        .map((message) => message.content.trim()),
    ),
  };
  const dedupedSkillHistoryMessages = skillHistoryMessages.filter((message) => {
    if (message.chatId !== undefined && liveChatIds.has(message.chatId)) {
      return false;
    }
    return !(
      message.role === "user" &&
      message.chatStatus === "in_progress" &&
      livePendingUserContentsByKind[message.kind].has(message.content.trim())
    );
  });

  // 歷史清單本來就照 created_at 由舊到新排列（見 rawSkillMessages 的翻頁反轉），
  // liveMessages 則是照送出/收到順序 push 的——兩段直接接起來就是正確順序，
  // 不需要另外算排序鍵、也不需要重新排序。
  const combinedMessages: PanelMessage[] = [
    ...dedupedSkillHistoryMessages,
    ...liveMessages,
  ];

  // 剛送出時 loading 泡泡是本地直接 push 的一則真正訊息（見 runSkill／
  // runAgentic）；但如果是「重新整理頁面時發現歷史裡有一則還在 in_progress
  // 的使用者訊息」，本地從來沒有 push 過任何東西，純資料庫回來的訊息裡也不會
  // 有一則「假裝在轉圈圈」的 assistant 列——這裡純粹依渲染順序補一個位置正確
  // 的 loading 佔位，不寫進任何 state，兩種情境用同一顆 loading 泡泡呈現。
  const renderedMessages: PanelMessage[] = [];
  combinedMessages.forEach((message, index) => {
    renderedMessages.push(message);
    if (
      message.role !== "user" ||
      message.chatStatus !== "in_progress" ||
      message.chatId === undefined
    ) {
      return;
    }
    const next = combinedMessages[index + 1];
    const alreadyHasReply = next?.chatId === message.chatId;
    if (alreadyHasReply) {
      return;
    }
    const loadingId = `loading-${message.chatId}`;
    if (message.kind === "skill") {
      renderedMessages.push({
        kind: "skill",
        id: loadingId,
        role: "assistant",
        content: "",
        speaker: STORYTELLER_ASSISTANT_NAME,
        isLoading: true,
        chatId: message.chatId,
      });
    } else {
      renderedMessages.push({
        kind: "agentic",
        id: loadingId,
        role: "assistant",
        content: "",
        isLoading: true,
        chatId: message.chatId,
      });
    }
  });

  // skill 現在也走背景執行，跟 agentic 對話共用同一套「還在 in_progress 就
  // polling」機制——不分 kind，只要是使用者訊息、有 chat_id、狀態還在處理中
  // 就要追。
  const inProgressAgenticChatIds = Array.from(
    new Set(
      combinedMessages.flatMap((message) =>
        message.role === "user" &&
        message.chatId !== undefined &&
        message.chatStatus === "in_progress"
          ? [message.chatId]
          : [],
      ),
    ),
  );
  const inProgressAgenticChatIdsKey = inProgressAgenticChatIds.join(",");

  useEffect(() => {
    if (
      !session?.encrypt_key ||
      !projectPublicId ||
      !targetPublicId ||
      inProgressAgenticChatIds.length === 0
    ) {
      return;
    }
    let stopped = false;
    const poll = async () => {
      const results = await Promise.allSettled(
        inProgressAgenticChatIds.map((chatId) =>
          fetchStorytellerAgenticChat({
            chatId,
            encryptKey: session.encrypt_key,
          }),
        ),
      );
      if (stopped) {
        return;
      }
      let shouldRefetchMessages = false;
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) {
          continue;
        }
        const chat = result.value;
        const messages = chat.messages
          .filter((message) => message.role !== "system")
          .map(panelMessageFromChatRow);
        if (messages.length > 0) {
          // 原地替換，不是「濾掉舊的、把新的接到陣列尾端」——這則對話原本在
          // liveMessages 裡的位置（使用者訊息後面）要保留，換成伺服器版本後
          // 不能因為 filter+push 被丟到陣列最後面，跑到後續訊息下面去。skill
          // 現在也走同一套背景執行＋輪詢，比對時不分 kind，只認 chat_id。
          setLiveMessages((prev) => {
            const insertAt = prev.findIndex(
              (message) => message.chatId === chat.chat_id,
            );
            const withoutOld = prev.filter(
              (message) => message.chatId !== chat.chat_id,
            );
            if (insertAt === -1) {
              return [...withoutOld, ...messages];
            }
            return [
              ...withoutOld.slice(0, insertAt),
              ...messages,
              ...withoutOld.slice(insertAt),
            ];
          });
        }
        if (chat.chat_status !== "in_progress") {
          shouldRefetchMessages = true;
        }
      }
      if (shouldRefetchMessages) {
        await queryClient.invalidateQueries({
          queryKey: [
            "storyteller",
            targetKind === "lore"
              ? "lore-chat-messages"
              : "story-chat-messages",
          ],
        });
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    inProgressAgenticChatIdsKey,
    projectPublicId,
    queryClient,
    session?.encrypt_key,
    targetKind,
    targetPublicId,
  ]);

  useLayoutEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [
    renderedMessages.length,
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
  // @ 參照與回覆對象改成結構化欄位送出（不再組成 fence 文字塞進 full_content），
  // 字數上限仍然合計計算，跟後端 validateAgentRunPayloadSize 對齊。
  const runReferences = toStorytellerAgentRunReferences(promptReferences);
  const replyContent = replyReferenceTarget?.content.trim() ?? "";
  const replyQuote = buildStorytellerAgentReplyQuote(replyReferenceTarget);
  const promptLength = Array.from(prompt).length;
  const instructionPayloadLength =
    promptLength + (replyQuote ? Array.from(`${replyQuote}\n\n`).length : 0);
  const referenceContentLength =
    runReferences.reduce(
      (sum, reference) => sum + Array.from(reference.content).length,
      0,
    ) + Array.from(replyContent).length;
  const totalPayloadLength = instructionPayloadLength + referenceContentLength;
  const payloadError =
    instructionPayloadLength > skillInstructionMaxCharacters
      ? `輸入需求最多 ${skillInstructionMaxCharacters.toLocaleString()} 字。`
      : referenceContentLength > skillFullContentMaxCharacters
        ? `引用內容最多 ${skillFullContentMaxCharacters.toLocaleString()} 字。`
        : totalPayloadLength > skillTotalPayloadMaxCharacters
          ? `單次 Agent payload 最多 ${skillTotalPayloadMaxCharacters.toLocaleString()} 字。`
          : "";
  const storyMentionQuery = currentStoryMentionQuery(
    prompt,
    promptSelection.start,
    promptSelection.end,
  );
  const loreMentionQuery = currentLoreMentionQuery(
    prompt,
    promptSelection.start,
    promptSelection.end,
  );
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
    Boolean(providerApiKeyId) &&
    Boolean(modelNameOverride) &&
    payloadError === "" &&
    !pending;

  function runSkill(mode: StorytellerAgentRunMode, instructionRaw: string) {
    const selectedContent = selectionAgentTarget?.selectedText ?? "";
    const instruction = composeStorytellerAgentInstructionWithReply(
      instructionRaw.trim(),
      replyReferenceTarget,
    );
    pendingSkillIdRef.current += 1;
    const userMessageId = `skill-pending-${pendingSkillIdRef.current}`;
    const loadingId = `skill-loading-${pendingSkillIdRef.current}`;
    pushLiveMessage({
      kind: "skill",
      id: userMessageId,
      role: "user",
      content: instruction.trim(),
      speaker: penName || "使用者",
      mode,
      selectedContent: selectedContent.trim() ? selectedContent : undefined,
    });
    pushLiveMessage({
      kind: "skill",
      id: loadingId,
      role: "assistant",
      content: "",
      speaker: STORYTELLER_ASSISTANT_NAME,
      isLoading: true,
    });
    setPrompt("");
    setReplyTarget(null);
    setSelectionAgentTarget(null);

    runSkillMutation.mutate(
      {
        input: {
          skill: mode,
          task: instruction,
          full_content: "",
          references: runReferences,
          reply_content: replyContent || undefined,
          selected_content: selectedContent,
          provider_apikey_id: Number(providerApiKeyId),
          model_name: modelNameOverride,
        },
      },
      {
        onSuccess: (result) => {
          if (!result) {
            removeLiveMessage(loadingId);
            return;
          }
          setLiveMessages((prev) =>
            prev.map((message) => {
              if (message.kind === "skill" && message.id === userMessageId) {
                return {
                  ...message,
                  id: result.user_message_id
                    ? String(result.user_message_id)
                    : message.id,
                  chatId: result.chat_id,
                  chatStatus: result.chat_status,
                };
              }
              // loading 泡泡也要標上 chatId，之後 polling 依 chatId 原地替換時
              // 才找得到它一併清掉，不然會留下一顆永遠轉圈圈的殘影泡泡。
              if (message.kind === "skill" && message.id === loadingId) {
                return { ...message, chatId: result.chat_id };
              }
              return message;
            }),
          );
          if (result.chat_status !== "completed") {
            // 還在背景生成，loading 泡泡留著不動，之後靠 polling 換成正式內容。
            return;
          }
          replaceLiveMessage(loadingId, {
            kind: "skill",
            id: result.assistant_message_id
              ? String(result.assistant_message_id)
              : loadingId,
            role: "assistant",
            content: result.result,
            speaker: STORYTELLER_ASSISTANT_NAME,
            expression: normalizeStorytellerAssistantExpression(
              result.expression,
            ),
            mode,
            usage: result.usage,
            resultSelection: null,
            isCurrentResult: true,
            chatId: result.chat_id,
            chatStatus: result.chat_status,
          });
        },
        onError: () => {
          removeLiveMessage(loadingId);
        },
      },
    );
  }

  function runAgentic(
    instruction: string,
    options?: {
      // 使用者用 /<名稱> 明確指定的自建 skill；沒帶就沒有人設。
      personaAgentId?: number;
      replyContent?: string;
      replyReference?: StorytellerAgenticReplyReferenceRequest;
      preserveComposer?: boolean;
    },
  ) {
    // key／model 是送出時的必填請求欄位（沒有 Agent 上的預設值可退回）。
    if (!providerApiKeyId || !modelNameOverride) {
      return;
    }
    // instruction 裡只有 composeStorytellerAgentInstructionWithReply 組的一行
    // 60 字摘要引言，方便人類跟模型定位「在回覆誰」；完整內容另外用 reply_content
    // 帶給後端，讓 agentic 模式真的讀得到被回覆訊息的全文，不是只看得到摘要。
    const replyContent =
      options?.replyContent !== undefined
        ? options.replyContent || undefined
        : replyReferenceTarget?.content || undefined;
    const replyReference =
      options?.replyReference ??
      buildAgenticMessageReplyReference(replyReferenceTarget);
    pendingAgenticIdRef.current += 1;
    const userMessageId = `agentic-user-${pendingAgenticIdRef.current}`;
    const loadingId = `agentic-loading-${pendingAgenticIdRef.current}`;
    const userMessage: Extract<PanelMessage, { kind: "agentic" }> = {
      kind: "agentic",
      id: userMessageId,
      role: "user",
      content: instruction,
      replyReference,
      replyContent: replyReference ? undefined : replyContent,
    };
    pushLiveMessage(userMessage);
    pushLiveMessage({
      kind: "agentic",
      id: loadingId,
      role: "assistant",
      content: "",
      isLoading: true,
    });
    if (!options?.preserveComposer) {
      setPrompt("");
    }
    // 回覆摘要只該陪著這一次送出的內容，訊息本身已經把 replyReferenceTarget
    // 組進 instruction 裡了（見兩個呼叫端都用 composeStorytellerAgentInstructionWithReply）
    // ——送出後就該清空，不然使用者送完下一則訊息時，輸入框上方還會一直卡著
    // 上一次回覆的摘要，跟這次送出的內容完全對不上。
    if (!options?.preserveComposer) {
      setReplyTarget(null);
      setSelectionAgentTarget(null);
    }

    runAgenticQuery.mutate(
      {
        input: {
          task: instruction,
          persona_agent_id: options?.personaAgentId,
          reply_content: replyContent,
          reply_reference: replyReference,
          provider_apikey_id: Number(providerApiKeyId),
          model_name: modelNameOverride,
        },
      },
      {
        onSuccess: (response) => {
          if (!response) {
            removeLiveMessage(loadingId);
            return;
          }
          setLiveMessages((prev) =>
            prev.map((message) => {
              if (message.kind === "agentic" && message.id === userMessageId) {
                return {
                  ...message,
                  id: response.user_message_id
                    ? String(response.user_message_id)
                    : message.id,
                  chatId: response.chat_id,
                  chatStatus: response.chat_status,
                };
              }
              // loading 泡泡也要標上 chatId，之後 polling 依 chatId 原地替換時
              // 才找得到它一併清掉，不然會留下一顆永遠轉圈圈的殘影泡泡。
              if (message.kind === "agentic" && message.id === loadingId) {
                return { ...message, chatId: response.chat_id };
              }
              return message;
            }),
          );
          if (response.chat_status !== "completed") {
            // 還在背景生成，loading 泡泡留著不動，之後靠 polling 換成正式內容。
            return;
          }
          replaceLiveMessage(loadingId, {
            kind: "agentic",
            id: response.assistant_message_id
              ? String(response.assistant_message_id)
              : loadingId,
            role: "assistant",
            content: response.result,
            expression: normalizeStorytellerAssistantExpression(
              response.expression,
            ),
            steps: response.steps,
            proposals: response.proposals,
            usage: response.usage,
            warning: response.warning,
            chatId: response.chat_id,
            chatStatus: response.chat_status,
          });
        },
        onError: (err) => {
          replaceLiveMessage(loadingId, {
            kind: "agentic",
            id: loadingId,
            role: "assistant",
            content: "",
            expression: "tangled",
            warning: agenticErrorMessage(err),
          });
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
        !providerApiKeyId ||
        !modelNameOverride ||
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
        { personaAgentId: targetAgentId },
      );
      return;
    }
    if (!canRun) {
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
    );
  }

  function insertAgentSlashPrefix(name: string) {
    setPrompt((current) => {
      const existing = matchAgentNameCommand(current, agents);
      const rest = existing ? existing.instruction : current;
      return `/${name} ${rest}`;
    });
  }

  function clearAgentSlashPrefix() {
    setPrompt((current) => {
      const existing = matchAgentNameCommand(current.trimStart(), agents);
      return existing ? existing.instruction : current;
    });
  }

  function syncPromptSelection(
    target:
      HTMLInputElement | HTMLTextAreaElement | null = promptTextareaRef.current,
  ) {
    if (!target) {
      return;
    }
    if (target.selectionStart === null || target.selectionEnd === null) {
      return;
    }
    const next = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    setPromptSelection((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }

  function insertPromptMention(kind: "story" | "lore", title: string) {
    const target = promptTextareaRef.current;
    const selectionStart = target?.selectionStart ?? promptSelection.start;
    const selectionEnd = target?.selectionEnd ?? promptSelection.end;
    const insertion =
      kind === "lore"
        ? insertLoreMention(prompt, selectionStart, selectionEnd, title)
        : insertStoryMention(prompt, selectionStart, selectionEnd, title);
    setPrompt(insertion.value);
    setPromptSelection({
      start: insertion.selectionStart,
      end: insertion.selectionEnd,
    });
    window.requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(
        insertion.selectionStart,
        insertion.selectionEnd,
      );
    });
  }

  function handleReply(message: StorytellerAgentPanelMessage) {
    setReplyTarget(message);
  }

  function handleRejectProposalWithFeedback(
    proposal: StorytellerAgenticProposal,
    feedback: string,
    proposalIndex: number,
  ) {
    const actionLabel = proposalActionLabel(proposal.tool_name);
    const contentSnippet = summarizeStorytellerAgentProposalArguments(
      proposal.arguments,
    );
    const rejectionQuote = buildStorytellerAgentProposalRejectionQuote(
      actionLabel,
      proposalIndex,
      contentSnippet,
    );
    // 否決 dialog 是獨立輸入，不該清掉使用者正在輸入框裡編輯的一般訊息或回覆草稿。
    // 被否決提案的完整工具參數只陪這次請求送進 reply_content，用完即拋。前面加一行
    // 「> 否決提案 #N：xxx（摘要）」的 blockquote 併入 instruction 本身（跟「回覆」
    // 訊息同一套手法），編號對應卡片上顯示的「修改提案 #N」，同一輪對話有好幾個
    // 同類型提案時才分得出是否決哪一則。
    runAgentic(
      composeStorytellerAgentInstructionWithProposalRejection(
        feedback.trim(),
        actionLabel,
        proposalIndex,
        contentSnippet,
      ),
      {
        replyContent: buildStorytellerAgentProposalReferenceContent(proposal),
        replyReference: {
          kind: "proposal",
          proposal_public_id: proposal.public_id,
          summary: rejectionQuote,
        },
        preserveComposer: true,
      },
    );
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
        height: fillAvailableHeight ? 1 : undefined,
        position: fillAvailableHeight ? undefined : { lg: "sticky" },
        top: fillAvailableHeight ? undefined : { lg: 16 },
      }}
    >
      <Stack
        sx={{
          height: fillAvailableHeight ? 1 : undefined,
          maxHeight: fillAvailableHeight
            ? undefined
            : { lg: "calc(100vh - 32px)" },
          minHeight: 0,
        }}
      >
        <Stack
          spacing={1.5}
          sx={{
            flexShrink: 0,
            p: 2,
            bgcolor: "background.default",
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
            {!floatingDock && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ minWidth: 120 }}
              >
                <SmartToyIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  AI 協作
                </Typography>
              </Stack>
            )}
            {workspace && onClose && (
              <Tooltip title="關閉 AI 協作">
                <IconButton
                  size="small"
                  aria-label="關閉 AI 協作"
                  onClick={onClose}
                  sx={{ ml: "auto" }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
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
            minHeight: fillAvailableHeight ? 0 : { xs: 360, lg: 320 },
            maxHeight: fillAvailableHeight ? "none" : { xs: 520, lg: 480 },
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
          ) : renderedMessages.length > 0 || pending ? (
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
              {renderedMessages.map((message) =>
                message.kind === "skill" ? (
                  <StorytellerAgentMessage
                    key={message.id}
                    message={message}
                    userAvatarSrc={userAvatarSrc}
                    userAvatarFallback={userAvatarFallback}
                    assistantAvatarSrc={storytellerAssistantAvatarSrc(
                      message.expression,
                    )}
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
                    userAvatarSrc={userAvatarSrc}
                    userAvatarFallback={userAvatarFallback}
                    targetKind={targetKind}
                    projectPublicId={projectPublicId}
                    targetPublicId={targetPublicId}
                    otherStories={otherStories}
                    lores={lores}
                    currentStory={currentStory}
                    onStoryChanged={onStoryChanged}
                    onApplyText={onApplyText}
                    onApplyProposalToEditor={onApplyProposalToEditor}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSaveBeforeApply={onSaveBeforeApply}
                    onRejectProposalWithFeedback={
                      handleRejectProposalWithFeedback
                    }
                    onReply={handleReply}
                    isReplyTarget={replyTarget?.id === message.id}
                    onResend={handleResend}
                    resendingChatId={resendingChatId}
                  />
                ),
              )}
            </>
          ) : (
            <CustomEmptyState
              icon={
                <Box
                  component="img"
                  alt="梭梭"
                  src={storytellerMascotSrc("thinking", appearance, "256")}
                  sx={{ width: 96, height: 96, objectFit: "contain" }}
                />
              }
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

        <Stack
          spacing={1.5}
          sx={{
            flexShrink: 0,
            maxHeight: fillAvailableHeight ? "46%" : undefined,
            overflow: fillAvailableHeight ? "auto" : undefined,
            p: 2,
          }}
        >
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
          {selectionAgentTarget && (
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {STORYTELLER_AI_SCOPE_LABELS[selectionAgentTarget.scope]}:{" "}
                  {truncateStorytellerSelectionPreview(
                    selectionAgentTarget.selectedText,
                  )}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => setSelectionAgentTarget(null)}
              >
                取消
              </Button>
            </Stack>
          )}
          <Paper
            variant="outlined"
            sx={{
              position: "relative",
              borderRadius: 2.5,
              borderColor: payloadError ? "error.main" : "divider",
              bgcolor: "background.paper",
              p: 1,
              pb: 5.5,
            }}
          >
            <Box sx={{ position: "relative" }}>
              <TextField
                variant="standard"
                multiline
                minRows={compactComposer ? 2 : 3}
                maxRows={compactComposer ? 5 : 8}
                fullWidth
                inputRef={promptTextareaRef}
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  syncPromptSelection(event.target);
                }}
                onSelect={(event) =>
                  syncPromptSelection(event.target as HTMLTextAreaElement)
                }
                onKeyUp={(event) =>
                  syncPromptSelection(event.target as HTMLTextAreaElement)
                }
                onMouseUp={(event) =>
                  syncPromptSelection(event.target as HTMLTextAreaElement)
                }
                onCompositionStart={() => setIsComposingPrompt(true)}
                onCompositionEnd={(event) => {
                  setIsComposingPrompt(false);
                  syncPromptSelection(event.target as HTMLTextAreaElement);
                }}
                placeholder="問 AI，或輸入 / 使用指令..."
                error={Boolean(payloadError)}
                helperText={payloadError || undefined}
                slotProps={{ input: { disableUnderline: true } }}
                sx={{
                  "& .MuiInputBase-root": { p: 0.5 },
                  "& .MuiFormHelperText-root": { mx: 0.5 },
                  "& .MuiInputBase-input": {
                    // 跟訊息泡泡的 body2 對齊（見 AgenticAssistantMessage 的
                    // typography: "body2"），輸入框預設用 TextField 的 1rem 明顯
                    // 比對話內容大一號，改小一點也能塞進更多字。
                    fontSize: "0.875rem",
                    color: isComposingPrompt ? "text.primary" : "transparent",
                    caretColor: (theme) => theme.palette.text.primary,
                    "&::placeholder": {
                      color: "text.secondary",
                      opacity: 1,
                    },
                  },
                }}
              />
              {!isComposingPrompt && (
                <StorytellerPromptHighlightOverlay
                  text={prompt}
                  textareaRef={promptTextareaRef}
                  slashCommandHighlightLength={recognizedSlashCommandPrefixLength(
                    prompt,
                    agents,
                  )}
                />
              )}
            </Box>
            <Stack
              direction="row"
              spacing={0.25}
              alignItems="center"
              sx={{
                position: "absolute",
                left: 8,
                right: 52,
                bottom: 8,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {workspace && (
                <StorytellerAIQuickActions
                  onSelect={(value) => {
                    setPrompt(value);
                    setPromptSelection({
                      start: value.length,
                      end: value.length,
                    });
                    window.requestAnimationFrame(() => {
                      promptTextareaRef.current?.focus();
                      promptTextareaRef.current?.setSelectionRange(
                        value.length,
                        value.length,
                      );
                    });
                  }}
                />
              )}
              {workspace && (
                <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
              )}
              <Tooltip title={`本次人設：${promptAgent?.name ?? "無人設"}`}>
                <span>
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<SmartToyIcon fontSize="small" />}
                    endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                    aria-label={`本次人設：${promptAgent?.name ?? "無人設"}；點擊切換`}
                    onClick={(event) => setAgentMenuAnchor(event.currentTarget)}
                    disabled={agents.length === 0}
                    sx={{
                      minWidth: 0,
                      maxWidth: 160,
                      px: 0.75,
                      textTransform: "none",
                      color: "text.secondary",
                      "& .MuiButton-startIcon": { mr: 0.5 },
                      "& .MuiButton-endIcon": { ml: 0.25 },
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="span"
                      noWrap
                      sx={{ fontWeight: 600 }}
                    >
                      {agents.length === 0
                        ? "尚無 Agent"
                        : (promptAgent?.name ?? "無人設")}
                    </Typography>
                  </Button>
                </span>
              </Tooltip>
              <Menu
                anchorEl={agentMenuAnchor}
                open={Boolean(agentMenuAnchor)}
                onClose={() => setAgentMenuAnchor(null)}
              >
                <ListSubheader>本次訊息使用的人設</ListSubheader>
                <MenuItem
                  selected={!promptAgent}
                  onClick={() => {
                    clearAgentSlashPrefix();
                    setAgentMenuAnchor(null);
                  }}
                >
                  無人設
                </MenuItem>
                {agents.map((agent) => (
                  <MenuItem
                    key={agent.id}
                    selected={promptAgent?.id === agent.id}
                    onClick={() => {
                      insertAgentSlashPrefix(agent.name);
                      setAgentMenuAnchor(null);
                    }}
                  >
                    {agent.name}
                  </MenuItem>
                ))}
              </Menu>
              <Tooltip
                title={`目前使用 ${effectiveProviderLabel} · ${effectiveModelLabel}；API Key：${
                  overriddenApiKey
                    ? overriddenApiKey.label || `金鑰 #${overriddenApiKey.id}`
                    : "未設定"
                }`}
              >
                <span>
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<ModelTrainingIcon fontSize="small" />}
                    endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                    aria-label={`目前使用 ${effectiveProviderLabel}，模型 ${effectiveModelLabel}；點擊切換`}
                    onClick={(event) => {
                      if (
                        providerAllowsCustomModel &&
                        modelOptions.length === 0 &&
                        !usesSelfHostedModelPicker
                      ) {
                        setCustomModelInput(modelNameOverride);
                      }
                      setAiConfigMenuAnchor(event.currentTarget);
                    }}
                    disabled={!hasAnyApiKey}
                    sx={{
                      minWidth: 0,
                      maxWidth: { xs: 220, sm: 360 },
                      px: 0.75,
                      textTransform: "none",
                      color: "text.secondary",
                      "& .MuiButton-startIcon": { mr: 0.5 },
                      "& .MuiButton-endIcon": { ml: 0.25 },
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="span"
                      noWrap
                      sx={{ fontWeight: 600 }}
                    >
                      {effectiveProviderLabel} · {effectiveModelLabel}
                    </Typography>
                  </Button>
                </span>
              </Tooltip>
              <Popover
                anchorEl={aiConfigMenuAnchor}
                open={Boolean(aiConfigMenuAnchor)}
                onClose={closeAiConfigMenu}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                  paper: {
                    sx: {
                      width: { xs: "calc(100vw - 24px)", sm: 620 },
                      maxWidth: "calc(100vw - 24px)",
                      overflow: "hidden",
                    },
                  },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "42% 58%", sm: "240px 1fr" },
                    height: "min(360px, calc(100vh - 32px))",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  >
                    <ListSubheader
                      component="div"
                      sx={{ borderBottom: 1, borderColor: "divider" }}
                    >
                      Provider / API Key
                    </ListSubheader>
                    <MenuList
                      dense
                      disablePadding
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        scrollbarWidth: "thin",
                      }}
                    >
                      {overrideApiKeyOptions.map((apiKey) => {
                        const providerLabel =
                          providerModelsList.find(
                            (entry) => entry.provider === apiKey.provider,
                          )?.label ?? apiKey.provider;
                        return (
                          <MenuItem
                            key={apiKey.id}
                            selected={providerApiKeyId === String(apiKey.id)}
                            onClick={() =>
                              setProviderApiKeyId(String(apiKey.id))
                            }
                          >
                            <Stack sx={{ minWidth: 0 }}>
                              <Typography variant="body2" noWrap>
                                {providerLabel}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {apiKey.label || `金鑰 #${apiKey.id}`}
                              </Typography>
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </MenuList>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                      minHeight: 0,
                      borderLeft: 1,
                      borderColor: "divider",
                    }}
                  >
                    <ListSubheader component="div">
                      Model · {effectiveProviderLabel}
                    </ListSubheader>
                    {effectiveProvider !== "self_hosted" &&
                      modelOptions.length > 0 && (
                        <Box
                          sx={{
                            px: 1,
                            pb: 1,
                            borderBottom: 1,
                            borderColor: "divider",
                          }}
                        >
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="篩選 Model..."
                            value={modelFilter}
                            onChange={(event) =>
                              setModelFilter(event.target.value)
                            }
                            slotProps={{ htmlInput: { autoComplete: "off" } }}
                          />
                        </Box>
                      )}
                    <MenuList
                      dense
                      disablePadding
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "scroll",
                        scrollbarGutter: "stable",
                        scrollbarWidth: "thin",
                        "&::-webkit-scrollbar": { width: 8 },
                        "&::-webkit-scrollbar-track": {
                          bgcolor: "action.hover",
                        },
                        "&::-webkit-scrollbar-thumb": {
                          bgcolor: "text.disabled",
                          borderRadius: 1,
                        },
                      }}
                    >
                      {usesSelfHostedModelPicker ? (
                        <SelfHostedModelPicker
                          apiKeyId={
                            providerApiKeyId ? Number(providerApiKeyId) : null
                          }
                          value={modelNameOverride}
                          onChange={setModelNameOverride}
                          onApplied={closeAiConfigMenu}
                          onSuccessNotify={setModelAppliedSnack}
                          variant="menu"
                          inputMode="always"
                          label="自訂模型名稱"
                        />
                      ) : providerAllowsCustomModel &&
                        modelOptions.length === 0 ? (
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          alignItems={{ sm: "center" }}
                          sx={{ p: 1 }}
                        >
                          <TextField
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
                                closeAiConfigMenu();
                              }
                            }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setModelNameOverride(customModelInput.trim());
                              closeAiConfigMenu();
                            }}
                          >
                            套用
                          </Button>
                        </Stack>
                      ) : filteredModelOptions.length > 0 ? (
                        filteredModelOptions.map((model) => (
                          <MenuItem
                            key={model.id}
                            selected={modelNameOverride === model.name}
                            onClick={() => {
                              setModelNameOverride(model.name);
                              closeAiConfigMenu();
                            }}
                          >
                            <Typography variant="body2" noWrap>
                              {model.label || model.name}
                            </Typography>
                          </MenuItem>
                        ))
                      ) : modelOptions.length > 0 ? (
                        <MenuItem disabled>找不到符合的 Model</MenuItem>
                      ) : (
                        <MenuItem disabled>這個 Provider 沒有可用模型</MenuItem>
                      )}
                    </MenuList>
                  </Box>
                </Box>
              </Popover>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
              <Stack direction="row" spacing={0.25} alignItems="center">
                <StorytellerMarkdownSyntaxDrawer
                  trigger={(openDrawer) => (
                    <Tooltip title="Markdown 語法">
                      <IconButton
                        size="small"
                        aria-label="Markdown 語法"
                        onClick={openDrawer}
                      >
                        <CodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                />
                <Tooltip title="指令與引用說明">
                  <IconButton
                    size="small"
                    aria-label="指令與引用說明"
                    onClick={() => setReferenceDrawerOpen(true)}
                  >
                    <MenuBookOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
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
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPromptMention("story", item.title)}
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
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPromptMention("lore", item.title)}
                  >
                    設定集：{item.title}
                  </Button>
                ))}
              </Stack>
            )}
            <Tooltip title={SKILL_SLASH_COMMAND_HINT}>
              <Box
                component="span"
                sx={{ position: "absolute", right: 8, bottom: 8 }}
              >
                <IconButton
                  color="primary"
                  aria-label={pending ? "處理中" : "送出"}
                  disabled={!canRun}
                  onClick={handleSend}
                  sx={{
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&.Mui-disabled": {
                      bgcolor: "action.disabledBackground",
                    },
                  }}
                >
                  {pending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SendIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            </Tooltip>
          </Paper>
        </Stack>
      </Stack>
      <StorytellerAgentReferenceDrawer
        open={referenceDrawerOpen}
        onClose={() => setReferenceDrawerOpen(false)}
        agents={agents}
      />
      <CustomSnackbar
        open={Boolean(resendError)}
        message={resendError}
        severity="error"
        onClose={() => setResendError("")}
      />
      <CustomSnackbar
        open={Boolean(modelAppliedSnack)}
        message={modelAppliedSnack}
        onClose={() => setModelAppliedSnack("")}
      />
    </Paper>
  );
}
