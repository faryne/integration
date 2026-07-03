import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplyIcon from "@mui/icons-material/Reply";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { StorytellerAgentReferenceDrawer } from "@/pages/storyteller/StorytellerAgentReferenceDrawer.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { StorytellerMarkdownSyntaxLink } from "@/pages/storyteller/StorytellerMarkdownSyntaxDrawer.tsx";
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

interface StorytellerAgentPanelProps {
  agents: StorytellerAgentPanelAgent[];
  selectedAgentId: string;
  onSelectedAgentChange: (agentId: string) => void;
  messages: StorytellerAgentPanelMessage[];
  messagesLoading: boolean;
  pending: boolean;
  unavailableMessage?: string;
  emptyTitle: string;
  emptyDescription: string;
  hasMoreHistory: boolean;
  loadingMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  errorMessage?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  promptPlaceholder: string;
  promptHelperText?: string;
  promptError?: boolean;
  promptWarning?: string;
  promptExtras?: ReactNode;
  canRun: boolean;
  onRun: () => void;
  onApplyText: (
    text: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  enableReplace?: boolean;
  replyTarget?: StorytellerAgentPanelMessage | null;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  onCancelReply?: () => void;
}

export function StorytellerAgentPanel(props: StorytellerAgentPanelProps) {
  const [referenceDrawerOpen, setReferenceDrawerOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedAgent =
    props.agents.find((agent) => agent.id === props.selectedAgentId) ??
    props.agents[0];
  const { messagesLoading } = props;
  const messageCount = props.messages.length;
  // 記錄「載入更早的訊息」點擊當下的捲動高度；新訊息載入完成後用來校正捲動位置，
  // 讓畫面停留在原本閱讀的地方，不會因為上方多了內容而往下跳
  const loadingMoreAnchorRef = useRef<number | null>(null);

  // 載入完成、訊息增減或處理狀態改變時自動捲到列表底部；
  // 若是使用者剛按過「載入更早的訊息」（新內容加在最上面），改成校正捲動位置而非捲到底部
  useLayoutEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) {
      return;
    }
    if (loadingMoreAnchorRef.current !== null) {
      node.scrollTop += node.scrollHeight - loadingMoreAnchorRef.current;
      loadingMoreAnchorRef.current = null;
      return;
    }
    if (messagesLoading) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messageCount, props.pending, messagesLoading]);

  function handleLoadMoreHistory() {
    loadingMoreAnchorRef.current =
      messagesContainerRef.current?.scrollHeight ?? null;
    props.onLoadMoreHistory();
  }

  function scrollToReplyTarget() {
    const replyTarget = props.replyTarget;
    if (!replyTarget) {
      return;
    }
    const node = messagesContainerRef.current?.querySelector(
      `[data-agent-message-id="${CSS.escape(replyTarget.id)}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
            direction={{ xs: "column", sm: "row", lg: "row" }}
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
                AI Agent
              </Typography>
            </Stack>
            <TextField
              select
              size="small"
              label="選擇 Agent"
              value={selectedAgent?.id ?? ""}
              onChange={(event) =>
                props.onSelectedAgentChange(event.target.value)
              }
              sx={{ flex: 1, minWidth: 180 }}
            >
              {props.agents.map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  {agent.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {selectedAgent && (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={selectedAgent.enabled ? "可用" : "停用"}
                  color={selectedAgent.enabled ? "success" : "default"}
                />
                <Chip size="small" label={selectedAgent.provider} />
                <Chip size="small" label={selectedAgent.model} />
              </Stack>
              <Tooltip
                title={
                  <Box
                    sx={{
                      maxWidth: 520,
                      maxHeight: 320,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {selectedAgent.prompt || "未設定 Prompt。"}
                  </Box>
                }
                placement="bottom-start"
                enterDelay={400}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: "-webkit-box",
                    overflow: "hidden",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    cursor: "help",
                  }}
                >
                  {selectedAgent.prompt || "未設定 Prompt。"}
                </Typography>
              </Tooltip>
            </>
          )}

          {props.unavailableMessage && (
            <Alert severity="info" variant="outlined">
              {props.unavailableMessage}
            </Alert>
          )}
        </Stack>

        <Divider />

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
          }}
        >
          {props.messagesLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                正在載入 AI Agent 對話紀錄...
              </Typography>
            </Stack>
          ) : props.messages.length > 0 || props.pending ? (
            <>
              {props.hasMoreHistory && (
                <Stack direction="row" justifyContent="center">
                  <Button
                    size="small"
                    variant="text"
                    disabled={props.loadingMoreHistory}
                    onClick={handleLoadMoreHistory}
                    startIcon={
                      props.loadingMoreHistory ? (
                        <CircularProgress size={14} />
                      ) : undefined
                    }
                  >
                    {props.loadingMoreHistory ? "載入中..." : "載入更早的訊息"}
                  </Button>
                </Stack>
              )}
              {props.messages.map((message) => (
                <StorytellerAgentMessage
                  key={message.id}
                  message={message}
                  enableReplace={Boolean(props.enableReplace)}
                  onApplyText={props.onApplyText}
                  onReply={props.onReply}
                  isReplyTarget={props.replyTarget?.id === message.id}
                />
              ))}
              {/* 處理中泡泡固定顯示在列表尾端，位置與稍後的回應一致 */}
              {props.pending && (
                <StorytellerAgentMessage
                  message={{
                    id: "agent-pending",
                    role: "assistant",
                    content: "",
                    speaker: selectedAgent?.name ?? "AI Agent",
                    isLoading: true,
                  }}
                  enableReplace={false}
                  onApplyText={props.onApplyText}
                />
              )}
            </>
          ) : (
            <CustomEmptyState
              icon={<SmartToyIcon fontSize="large" />}
              title={props.emptyTitle}
              description={props.emptyDescription}
            />
          )}
          {props.errorMessage && (
            <Alert severity="error" variant="outlined">
              {props.errorMessage}
            </Alert>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.5} sx={{ p: 2 }}>
          {props.replyTarget && (
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
                  回覆 {props.replyTarget.speaker}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {props.replyTarget.content}
                </Typography>
              </Box>
              <IconButton size="small" onClick={props.onCancelReply}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          <TextField
            multiline
            minRows={4}
            maxRows={8}
            label="輸入需求"
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            placeholder={props.promptPlaceholder}
            error={props.promptError}
            helperText={props.promptHelperText}
          />
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
          {props.promptWarning && (
            <Alert severity="warning" variant="outlined">
              {props.promptWarning}
            </Alert>
          )}
          {props.promptExtras}
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            disabled={!props.canRun}
            onClick={props.onRun}
          >
            {props.pending ? "處理中" : "送出需求"}
          </Button>
        </Stack>
      </Stack>
      <StorytellerAgentReferenceDrawer
        open={referenceDrawerOpen}
        onClose={() => setReferenceDrawerOpen(false)}
      />
    </Paper>
  );
}

interface StorytellerAgentMessageProps {
  message: StorytellerAgentPanelMessage;
  enableReplace: boolean;
  onApplyText: (
    text: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  isReplyTarget?: boolean;
}

function StorytellerAgentMessage(props: StorytellerAgentMessageProps) {
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
              處理中...
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
            {props.enableReplace && message.isCurrentResult && (
              <Button
                size="small"
                variant="outlined"
                disabled={!message.resultSelection}
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
            <Button
              size="small"
              variant="outlined"
              onClick={() => props.onApplyText(message.content, "insert", null)}
            >
              插入游標
            </Button>
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
