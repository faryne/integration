import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplyIcon from "@mui/icons-material/Reply";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
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
  usage?: StorytellerAgentRunResponse["usage"];
  resultSelection?: StorytellerAgentPanelSelection | null;
  isLoading?: boolean;
  isCurrentResult?: boolean;
}

export type StorytellerAgentApplyAction =
  | "replace"
  | "insert"
  | "append"
  | "copy";

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
}

// 由 StorytellerAgenticPanel.tsx（「AI 助理」面板）在渲染 skill（slash command）
// 觸發的訊息時複用，維持一套訊息泡泡樣式與套用按鈕邏輯，不重複刻一份。
export function StorytellerAgentMessage(props: StorytellerAgentMessageProps) {
  const { message } = props;
  const isUser = message.role === "user";
  const canApply = !isUser && message.content.trim() !== "";

  return (
    <Box
      data-agent-message-id={message.id}
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Box
        sx={{
          maxWidth: "92%",
          p: 1.5,
          borderRadius: 1,
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? 0 : "1px solid",
          borderColor: props.isReplyTarget ? "primary.main" : "divider",
          outline: props.isReplyTarget ? "2px solid" : "none",
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
        <Typography
          variant="caption"
          color={isUser ? "inherit" : "text.secondary"}
          sx={{ opacity: isUser ? 0.82 : 1 }}
        >
          {message.speaker}
        </Typography>
        {message.isLoading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              <StorytellerAgentLoadingHint />
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ typography: "body2", mt: 0.5 }}>
            <StorytellerMarkdown>{message.content}</StorytellerMarkdown>
          </Box>
        )}
        {!isUser && message.isCurrentResult && (
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1 }}
          >
            {message.mode && <Chip size="small" label={message.mode} />}
            {message.usage?.total_tokens ? (
              <Chip
                size="small"
                label={`${message.usage.total_tokens} tokens`}
              />
            ) : null}
          </Stack>
        )}
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
                  size="small"
                  variant="outlined"
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
                size="small"
                variant="outlined"
                onClick={() =>
                  props.onApplyText(message.content, "insert", null)
                }
              >
                插入游標
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={() => props.onApplyText(message.content, "append", null)}
            >
              附加末尾
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => props.onApplyText(message.content, "copy", null)}
            >
              複製
            </Button>
            {props.onReply && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ReplyIcon />}
                onClick={() => props.onReply?.(message)}
              >
                回覆
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
