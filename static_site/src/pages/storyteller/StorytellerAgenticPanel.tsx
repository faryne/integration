import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLayoutEffect, useRef, useState } from "react";
import {
  useRunStorytellerAgenticQuery,
  useStorytellerProviderAPIKeys,
} from "@/apis/storyteller/agent.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import type { StorytellerAgenticCurrentStory } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import { StorytellerAgenticProposalCard } from "@/pages/storyteller/StorytellerAgenticProposalCard.tsx";
import type {
  StorytellerAgenticProposal,
  StorytellerAgenticStep,
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
  return "AI Agent 呼叫失敗，請確認 Agent 設定與後端狀態。";
}

interface AgenticChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: StorytellerAgenticStep[];
  proposals?: StorytellerAgenticProposal[];
  usage?: { total_tokens?: number };
  warning?: string;
  isLoading?: boolean;
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

export function StorytellerAgenticPanel({
  projectPublicId,
  storyPublicId,
  agentId,
  currentStory,
  onStoryChanged,
}: {
  projectPublicId?: string;
  storyPublicId?: string;
  agentId?: number;
  currentStory: StorytellerAgenticCurrentStory;
  onStoryChanged?: () => void;
}) {
  const [messages, setMessages] = useState<AgenticChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [providerApiKeyId, setProviderApiKeyId] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const { data: providerApiKeys = [] } = useStorytellerProviderAPIKeys();
  const runQuery = useRunStorytellerAgenticQuery(
    projectPublicId,
    storyPublicId,
  );

  useLayoutEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages.length, runQuery.isPending]);

  const canRun =
    Boolean(prompt.trim()) &&
    Boolean(projectPublicId) &&
    Boolean(storyPublicId) &&
    Boolean(agentId) &&
    !runQuery.isPending;

  function handleSend() {
    if (!canRun || !agentId) {
      return;
    }
    const userMessage: AgenticChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");

    runQuery.mutate(
      {
        agentId,
        input: {
          user_prompt: userMessage.content,
          provider_apikey_id: providerApiKeyId
            ? Number(providerApiKeyId)
            : undefined,
        },
      },
      {
        onSuccess: (response) => {
          if (!response) {
            return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
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
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-error-${Date.now()}`,
              role: "assistant",
              content: "",
              warning: agenticErrorMessage(err),
            },
          ]);
        },
      },
    );
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
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 120 }}>
              <SmartToyIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>
                AI Agent
              </Typography>
            </Stack>
            <TextField
              select
              size="small"
              label="使用哪把 API Key"
              value={providerApiKeyId}
              onChange={(event) => setProviderApiKeyId(event.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
              helperText="留空沿用 Agent 預設的 key／model"
            >
              <MenuItem value="">Agent 預設</MenuItem>
              {providerApiKeys.map((key) => (
                <MenuItem key={key.id} value={String(key.id)}>
                  {key.label || `金鑰 #${key.id}`}（{key.provider}）
                </MenuItem>
              ))}
            </TextField>
          </Stack>
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
          {messages.length === 0 && !runQuery.isPending ? (
            <CustomEmptyState
              icon={<SmartToyIcon fontSize="large" />}
              title="還沒有對話"
              description="AI Agent 可以自己讀這個專案底下的故事/設定集/資產再回答，也可以提出修改提案讓你確認後套用。"
            />
          ) : (
            <>
              {messages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: "flex",
                    justifyContent:
                      message.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: "94%",
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor:
                        message.role === "user"
                          ? "primary.main"
                          : "background.paper",
                      color:
                        message.role === "user"
                          ? "primary.contrastText"
                          : "text.primary",
                      border: message.role === "user" ? 0 : "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color={message.role === "user" ? "inherit" : "text.secondary"}
                    >
                      {message.role === "user" ? "你" : "AI Agent"}
                    </Typography>
                    {message.content && (
                      <Box sx={{ typography: "body2", mt: 0.5 }}>
                        <StorytellerMarkdown>
                          {message.content}
                        </StorytellerMarkdown>
                      </Box>
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
              ))}
              {runQuery.isPending && (
                <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        AI Agent 正在處理...
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>
              )}
            </>
          )}
        </Stack>

        <Stack spacing={1.5} sx={{ p: 2 }}>
          <TextField
            multiline
            minRows={3}
            maxRows={8}
            label="輸入需求"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：幫我把這段開頭改得更懸疑一點，順便看看跟莉亞的人物設定有沒有衝突。"
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            disabled={!canRun}
            onClick={handleSend}
          >
            {runQuery.isPending ? "處理中" : "送出需求"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
