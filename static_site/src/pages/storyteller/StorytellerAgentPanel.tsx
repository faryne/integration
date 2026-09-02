import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplyIcon from "@mui/icons-material/Reply";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { ButtonProps } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { buildStorytellerAgentMessageLinks } from "@/pages/storyteller/storytellerAgentReferences.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunResponse,
} from "@/types/storyteller.ts";

export interface StorytellerAgentPanelAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  prompt: string;
  enabled: boolean;
}

export interface StorytellerAgentPanelSelection {
  start: number;
  end: number;
  text: string;
}

export interface StorytellerAgentPanelMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  speaker: string;
  mode?: StorytellerAgentRunMode;
  // 選字觸發 skill 時保留原始選取段落，讓送出當下與重整後都看得出指令作用範圍。
  selectedContent?: string;
  usage?: StorytellerAgentRunResponse["usage"];
  resultSelection?: StorytellerAgentPanelSelection | null;
  isLoading?: boolean;
  isCurrentResult?: boolean;
  // 這則訊息實際是哪個 Agent 人設處理的——不一定等於 speaker（skill 訊息的
  // speaker 對 user 那則是「你」，不是人設名稱）。用來在泡泡上標「這則走了
  // 哪個 Agent／哪個指令」，事後回頭看對話紀錄才知道當時發生什麼事。
  agentName?: string;
  // skill 現在也走背景執行＋輪詢：chatId／chatStatus 讓 loading 中的 skill
  // 訊息能被跟 agentic 對話同一套 polling 邏輯認出來、換成正式結果；
  // chatStatus="pending" 代表背景呼叫失敗，沒有拿到回覆。
  chatId?: number;
  chatStatus?: "pending" | "in_progress" | "completed";
}

// /rewrite／/expand 等 skill 指令的完整 mode 值 -> 中文短標籤，給訊息泡泡上的
// 「這則走了哪個指令」標籤用。跟 StorytellerAgenticPanel.tsx 的
// SKILL_SLASH_COMMAND_LABELS（短指令字 -> 中文）是同一份語意，只是這裡的 key
// 是完整 mode 值（存進 metadata 的就是這個），兩邊分別維護，改的時候要記得對照。
const AGENT_RUN_MODE_LABELS: Record<StorytellerAgentRunMode, string> = {
  rewrite_selection: "/rewrite 改寫",
  expand_selection: "/expand 擴寫",
  translate_selection: "/translate 翻譯",
  continue_chapter: "/continue 續寫",
  custom_selection: "/custom 自訂指令",
};

export function agentRunModeLabel(mode?: StorytellerAgentRunMode | string) {
  if (!mode) {
    return null;
  }
  return AGENT_RUN_MODE_LABELS[mode as StorytellerAgentRunMode] ?? null;
}

export type StorytellerAgentApplyAction =
  "replace" | "insert" | "append" | "copy";

// AI 助理一輪呼叫可能要跑好幾秒到好幾十秒（多輪工具呼叫時尤其明顯），純轉圈圈
// 容易讓使用者懷疑「是不是壞了、關掉分頁會不會就消失了」。這裡先用便宜的做法
// 讓文字不定時輪替，至少感覺得到「還在動」——之後如果要做 SSE 步驟即時推播
// 再取代掉這個。
const AGENT_LOADING_HINTS = [
  "處理中…",
  "AI 正在讀取資料…",
  "還在努力生成內容…",
  "整理輸出格式中…",
  "快好了，請再等一下…",
];

const agentLoadingHintRotateSeconds = 3;

export function StorytellerAgentLoadingHint() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const hintIndex =
    Math.floor(elapsedSeconds / agentLoadingHintRotateSeconds) %
    AGENT_LOADING_HINTS.length;
  return (
    <>
      {AGENT_LOADING_HINTS[hintIndex]}（已等待 {elapsedSeconds} 秒）
    </>
  );
}

// 泡泡下面那排「附加末尾/複製/回覆」動作鍵，之前用 variant="outlined" 疊在泡泡
// 下面，等於又是一排跟泡泡本身一樣的方框，看起來像箱子疊箱子。改成無邊框的
// 文字按鈕，視覺上依附在泡泡上而不是獨立的一排容器——StorytellerAgentMessage／
// AgenticAssistantMessage 共用同一份，維持兩邊手感一致。
export const storytellerChatActionButtonProps: Pick<
  ButtonProps,
  "size" | "variant"
> = { size: "small", variant: "text" };

// 訊息泡泡的外觀（圓角、陰影、說話者標籤這層）給 StorytellerAgentMessage（skill
// 訊息）跟 StorytellerAgenticPanel.tsx 的 AgenticAssistantMessage（agentic 訊息）
// 共用——這兩個一直是「雙胞胎」，樣式改一邊很容易忘記改另一邊，抽出來後改一次
// 兩邊自動一起套用。
//
// 圓角刻意做成不對稱：貼近說話者那一側的角（使用者泡泡右下、AI 泡泡左下）留小，
// 其餘三個角放大，做出經典聊天泡泡「尖角指向說話者」的手感，不是四個角一樣的
// 卡片。原本完全沒有陰影，泡泡直接貼在同色系的面板底色上、只靠一條細邊框分界，
// 加一層很淺的陰影（MUI 內建 shadows[1]）讓泡泡從底色浮起來，是這次最主要的
// 「不再像方塊」的來源。
export function StorytellerChatBubble({
  messageId,
  isUser,
  isReplyTarget,
  speaker,
  badge,
  children,
}: {
  messageId: string;
  isUser: boolean;
  isReplyTarget?: boolean;
  speaker: ReactNode;
  // 這則訊息實際用了哪個 Agent 人設／哪個 skill 指令——小小一個 Chip 貼在
  // 說話者名稱旁邊，事後回頭看對話紀錄才追得回「這則當時發生了什麼事」。
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      data-agent-message-id={messageId}
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Box
        sx={{
          maxWidth: "92%",
          p: 1.5,
          borderRadius: "16px",
          borderBottomRightRadius: isUser ? "4px" : "16px",
          borderBottomLeftRadius: isUser ? "16px" : "4px",
          boxShadow: 1,
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? 0 : "1px solid",
          borderColor: isReplyTarget ? "primary.main" : "divider",
          outline: isReplyTarget ? "2px solid" : "none",
          outlineColor: "primary.main",
          "& blockquote": {
            m: 0,
            mt: 0.75,
            mb: 1,
            px: 1.25,
            py: 0.75,
            borderLeft: "3px solid",
            borderColor: isUser ? "primary.contrastText" : "primary.main",
            bgcolor: isUser ? "rgba(255,255,255,0.14)" : "action.hover",
            borderRadius: 0.5,
          },
          "& blockquote p": { m: 0 },
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Typography
            variant="caption"
            fontWeight={700}
            color={isUser ? "inherit" : "text.secondary"}
            sx={{ opacity: isUser ? 0.82 : 1 }}
          >
            {speaker}
          </Typography>
          {badge}
        </Stack>
        {children}
      </Box>
    </Box>
  );
}

// 給 StorytellerChatBubble 的 badge prop 用——mode（走了哪個 skill 指令）跟
// agentName（實際處理這則的 Agent 人設）各自獨立顯示，兩個都沒有就不渲染
// 任何東西（一般聊天訊息不用特別標）。
export function StorytellerChatBadges({
  mode,
  agentName,
}: {
  mode?: StorytellerAgentRunMode | string;
  agentName?: string;
}) {
  const modeLabel = agentRunModeLabel(mode);
  if (!modeLabel && !agentName) {
    return null;
  }
  return (
    <>
      {modeLabel && (
        <Chip
          size="small"
          variant="outlined"
          label={modeLabel}
          sx={{
            height: 18,
            "& .MuiChip-label": { px: 0.75, fontSize: "0.68rem" },
          }}
        />
      )}
      {agentName && (
        <Chip
          size="small"
          variant="outlined"
          label={agentName}
          sx={{
            height: 18,
            "& .MuiChip-label": { px: 0.75, fontSize: "0.68rem" },
          }}
        />
      )}
    </>
  );
}

export interface StorytellerAgentMessageProps {
  message: StorytellerAgentPanelMessage;
  enableReplace: boolean;
  enableInsert: boolean;
  onApplyText: (
    text: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  isReplyTarget?: boolean;
  // 給 @thisStory／@story:[...] 這類引用 token 解析成真連結用——留空時
  // （例如載入中的暫時訊息，content 本來就是空字串）直接照原樣顯示，不會出錯。
  targetKind?: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
  otherStories?: { id: string; title: string; content: string }[];
  lores?: { id: string; title: string; content: string }[];
}

// 由 StorytellerAgenticPanel.tsx（「AI 助理」面板）在渲染 skill（slash command）
// 觸發的訊息時複用，維持一套訊息泡泡樣式與套用按鈕邏輯，不重複刻一份。
export function StorytellerAgentMessage(props: StorytellerAgentMessageProps) {
  const { message } = props;
  const isUser = message.role === "user";
  const canApply = !isUser && message.content.trim() !== "";
  const linkedContent = props.targetKind
    ? buildStorytellerAgentMessageLinks(message.content, {
        targetKind: props.targetKind,
        projectPublicId: props.projectPublicId,
        targetPublicId: props.targetPublicId,
        otherStories: props.otherStories ?? [],
        lores: props.lores ?? [],
      })
    : message.content;

  return (
    <StorytellerChatBubble
      messageId={message.id}
      isUser={isUser}
      isReplyTarget={props.isReplyTarget}
      speaker={message.speaker}
      badge={
        <StorytellerChatBadges
          mode={message.mode}
          agentName={message.agentName}
        />
      }
    >
      {message.isLoading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            <StorytellerAgentLoadingHint />
          </Typography>
        </Stack>
      ) : (
        <Box sx={{ typography: "body2", mt: 0.5 }}>
          {message.selectedContent && (
            <Typography
              component="blockquote"
              variant="body2"
              sx={{
                m: 0,
                mb: message.content.trim() ? 1 : 0,
                pl: 1.25,
                py: 0.5,
                borderLeft: "3px solid",
                borderColor: "primary.main",
                color: "text.secondary",
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.selectedContent}
            </Typography>
          )}
          {message.content.trim() ? (
            <StorytellerMarkdown>{linkedContent}</StorytellerMarkdown>
          ) : null}
        </Box>
      )}
      {isUser && message.chatStatus === "pending" && (
        <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
          沒有拿到 AI 回覆（可能是連線問題或伺服器中斷），可以重新打一次指令試試。
        </Alert>
      )}
      {!isUser && message.usage?.total_tokens ? (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          <Chip size="small" label={`${message.usage.total_tokens} tokens`} />
        </Stack>
      ) : null}
      {canApply && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          {props.enableReplace &&
            message.isCurrentResult &&
            message.resultSelection && (
              <Button
                {...storytellerChatActionButtonProps}
                onClick={() =>
                  props.onApplyText(
                    message.content,
                    "replace",
                    message.resultSelection ?? null,
                  )
                }
              >
                取代選取
              </Button>
            )}
          {props.enableInsert && (
            <Button
              {...storytellerChatActionButtonProps}
              onClick={() => props.onApplyText(message.content, "insert", null)}
            >
              插入游標
            </Button>
          )}
          <Button
            {...storytellerChatActionButtonProps}
            onClick={() => props.onApplyText(message.content, "append", null)}
          >
            附加末尾
          </Button>
          <Button
            {...storytellerChatActionButtonProps}
            startIcon={<ContentCopyIcon />}
            onClick={() => props.onApplyText(message.content, "copy", null)}
          >
            複製
          </Button>
          {props.onReply && (
            <Button
              {...storytellerChatActionButtonProps}
              startIcon={<ReplyIcon />}
              onClick={() => props.onReply?.(message)}
            >
              回覆
            </Button>
          )}
        </Stack>
      )}
    </StorytellerChatBubble>
  );
}
