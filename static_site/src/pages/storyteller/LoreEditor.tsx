import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SubscriptIcon from "@mui/icons-material/Subscript";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import {
  useRunStorytellerLoreAgent,
  useSaveStorytellerLore,
  useStorytellerAgents,
  useStorytellerLoreChatMessages,
  useStorytellerLoreVersions,
  useStorytellerLores,
  useStorytellerProjects,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
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

const aiMessagesPerPage = 10;
const autoSaveIntervalMinutes = 2;

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
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentDraftRef = useRef(serializeLoreDraft("", ""));
  const lastSavedDraftRef = useRef(serializeLoreDraft("", ""));
  const latestDraftRef = useRef<LoreDraft>({ title: "", content: "" });
  const autoSaveRunningRef = useRef(false);
  const [tab, setTab] = useState("editor");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const [aiMessagePage, setAiMessagePage] = useState(1);
  const [snack, setSnack] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<AlertColor>("success");

  const { data: apiProjects = [], isPending: projectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const { data: apiLores = [], isPending: loresPending } = useStorytellerLores(
    apiProject?.public_id,
  );
  const apiLore = apiLores.find((item) => item.public_id === loreId);
  const { data: apiStories = [] } = useStorytellerStories(
    apiProject?.public_id,
  );
  const { data: versions = [], isLoading: versionsLoading } =
    useStorytellerLoreVersions(apiProject?.public_id, apiLore?.public_id);
  const { data: agents = [] } = useStorytellerAgents();
  const saveLore = useSaveStorytellerLore(apiProject?.public_id);
  const saveLoreRef = useRef(saveLore);
  const runAgent = useRunStorytellerLoreAgent(
    apiProject?.public_id,
    apiLore?.public_id,
  );
  const { data: aiMessagesPage, isLoading: aiMessagesLoading } =
    useStorytellerLoreChatMessages(
      apiProject?.public_id,
      apiLore?.public_id,
      aiMessagePage,
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
  const wordCount = useMemo(
    () => content.replace(/\s+/g, "").length,
    [content],
  );
  const selectedAgent =
    agents.find((agent) => String(agent.id) === selectedAgentId) ?? agents[0];
  const canRunAgent =
    !isNewLore &&
    Boolean(apiProject?.public_id && apiLore?.public_id && selectedAgent) &&
    !runAgent.isPending;
  const loreReferences = buildLoreReferences(aiPrompt);
  const aiMessages = aiMessagesPage?.items ?? [];
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
  const aiMessageTotalPages = Math.max(
    1,
    Math.ceil((aiMessagesPage?.total ?? 0) / aiMessagesPerPage),
  );
  const agentContext = loreReferences
    .map(
      (reference) =>
        `Reference lore: ${reference.title}\nToken: ${reference.token}\n<<<LORE_REFERENCE_CONTENT\n${reference.content}\nLORE_REFERENCE_CONTENT`,
    )
    .join("\n\n");
  const loreHistoryItems: StoryEditHistoryItem[] = versions.map((version) => ({
    id: String(version.id),
    title: version.title,
    source: "手動編輯",
    createdAt: version.created_at,
    words: version.word_count,
  }));

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

  useEffect(() => {
    if (!apiProject?.public_id || isNewLore || !lore?.id) {
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
  }, [apiProject?.public_id, isNewLore, lore?.id]);

  useTitle(`${pageTitle} - Storyteller`, {
    path: id && loreId ? `/storyteller/my/project/${id}/lore/${loreId}` : "",
    robots: "noindex, nofollow",
  });

  if (
    (!project && projectsPending) ||
    (apiProject && !isNewLore && !lore && loresPending)
  ) {
    return <StorytellerLoading label="正在載入設定集..." />;
  }

  if (!project || (!isNewLore && !lore)) {
    return <ErrorPage code={404} />;
  }

  function buildLoreReferences(value: string) {
    const references = [];
    if (value.includes("@thisLore")) {
      references.push({
        token: "@thisLore",
        title: title.trim() || lore?.title || "目前設定集",
        content,
      });
    }
    for (const item of apiLores) {
      const token = `@lore:${item.title}`;
      const bracketToken = `@lore:[${item.title}]`;
      if (
        item.public_id === apiLore?.public_id ||
        (!value.includes(token) && !value.includes(bracketToken))
      ) {
        continue;
      }
      references.push({
        token,
        title: item.title,
        content: item.latest_content,
      });
    }
    for (const story of apiStories) {
      const token = `@story:${story.title}`;
      const bracketToken = `@story:[${story.title}]`;
      if (!value.includes(token) && !value.includes(bracketToken)) {
        continue;
      }
      references.push({
        token,
        title: story.title,
        content: story.latest_content,
      });
    }
    return references;
  }

  function showSnack(message: string, severity: AlertColor = "success") {
    setSnack(message);
    setSnackSeverity(severity);
  }

  function applyMarkdownFormat(
    type: "bold" | "italic" | "subscript" | "left" | "center" | "right",
  ) {
    const target = textAreaRef.current;
    if (!target) {
      return;
    }
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selected = content.slice(start, end) || "文字";
    const replacements = {
      bold: `**${selected}**`,
      italic: `*${selected}*`,
      subscript: `<sub>${selected}</sub>`,
      left: `<div align="left">\n${selected}\n</div>`,
      center: `<div align="center">\n${selected}\n</div>`,
      right: `<div align="right">\n${selected}\n</div>`,
    };
    const replacement = replacements[type];
    setContent(`${content.slice(0, start)}${replacement}${content.slice(end)}`);
    window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start, start + replacement.length);
    });
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
    runAgent.mutate(
      {
        agentId: selectedAgent.id,
        input: {
          mode: "custom_chapter",
          instruction: aiPrompt.trim(),
          full_content:
            agentContext ||
            `Current lore:\n<<<LORE_CONTENT\n${content}\nLORE_CONTENT`,
          selected_content: "",
        },
      },
      {
        onSuccess: (result) => setAiResult(result?.result ?? ""),
        onError: (error) =>
          showSnack(errorMessage(error, "AI Agent 呼叫失敗。"), "error"),
      },
    );
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
      description="撰寫故事世界觀、角色規則、背景資料與劇本設定。"
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
          {saveLore.isError && (
            <Alert severity="error" variant="outlined">
              {errorMessage(saveLore.error, "設定集存檔失敗。")}
            </Alert>
          )}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 10 }}>
              <TextField
                label="設定集標題"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                fullWidth
                required
                placeholder="請輸入設定集標題"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
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
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 1, overflow: "hidden" }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              sx={{ px: 2, py: 1.5 }}
            >
              <Tabs value={tab} onChange={(_, value: string) => setTab(value)}>
                <Tab value="editor" label="文字編輯" />
                <Tab value="preview" label="預覽" />
                <Tab value="history" label="編輯歷史" disabled={isNewLore} />
              </Tabs>
            </Stack>
            <Divider />

            <Box sx={{ display: tab === "editor" ? "block" : "none", p: 2 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  mb: 2,
                  borderRadius: 1,
                  bgcolor: "background.default",
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Tooltip title="粗體">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("bold")}
                    >
                      <FormatBoldIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="斜體">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("italic")}
                    >
                      <FormatItalicIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="底標">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("subscript")}
                    >
                      <SubscriptIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  <Tooltip title="靠左">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("left")}
                    >
                      <FormatAlignLeftIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="置中">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("center")}
                    >
                      <FormatAlignCenterIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="靠右">
                    <IconButton
                      size="small"
                      onClick={() => applyMarkdownFormat("right")}
                    >
                      <FormatAlignRightIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
              <TextField
                inputRef={textAreaRef}
                label="Markdown 內容"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                fullWidth
                multiline
                minRows={22}
                placeholder="使用 Markdown 撰寫設定集內容"
                slotProps={{
                  input: {
                    sx: {
                      alignItems: "flex-start",
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                      lineHeight: 1.8,
                      height: { xs: 420, md: 560 },
                      overflow: "auto",
                      "& textarea": {
                        height: "100% !important",
                        overflow: "auto !important",
                      },
                    },
                  },
                }}
              />
            </Box>

            <Box sx={{ display: tab === "preview" ? "block" : "none", p: 3 }}>
              <Box
                sx={{
                  typography: "body1",
                  lineHeight: 1.9,
                  "& h1": { typography: "h4", fontWeight: 800 },
                  "& h2": { typography: "h5", fontWeight: 800, mt: 3 },
                  "& p": { my: 1.5 },
                  "& img": { maxWidth: "100%" },
                }}
              >
                <Markdown>{content || " "}</Markdown>
              </Box>
            </Box>

            <Box sx={{ display: tab === "history" ? "block" : "none", p: 2 }}>
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
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
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
                    value={String(selectedAgent?.id ?? "")}
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                    sx={{ flex: 1, minWidth: 180 }}
                  >
                    {agents.map((agent) => (
                      <MenuItem key={agent.id} value={String(agent.id)}>
                        {agent.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                {selectedAgent && (
                  <>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip size="small" label="可用" color="success" />
                      <Chip size="small" label={selectedAgent.provider} />
                      <Chip size="small" label={selectedAgent.model_name} />
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
                          {selectedAgent.default_prompt || "未設定 Prompt。"}
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
                        {selectedAgent.default_prompt || "未設定 Prompt。"}
                      </Typography>
                    </Tooltip>
                  </>
                )}
                {isNewLore && (
                  <Alert severity="info" variant="outlined">
                    設定集第一次存檔後才能呼叫 AI Agent。
                  </Alert>
                )}
              </Stack>

              <Divider />

              <Stack
                spacing={1.5}
                sx={{
                  flex: 1,
                  minHeight: { xs: 360, lg: 0 },
                  maxHeight: { xs: 520, lg: 480 },
                  overflow: "auto",
                  bgcolor: "grey.50",
                  p: 2,
                }}
              >
                {runAgent.isPending && (
                  <StorytellerLoading label="AI Agent 處理中..." />
                )}
                {aiMessagesLoading ? (
                  <StorytellerLoading label="正在載入 AI Agent 對話紀錄..." />
                ) : aiMessages.length > 0 || visibleAiResult ? (
                  <>
                    {aiMessages.map((message) => (
                      <Paper
                        key={message.id}
                        variant="outlined"
                        sx={{
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
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ opacity: message.role === "user" ? 0.82 : 1 }}
                        >
                          {message.role === "assistant"
                            ? message.agent_name || "AI Agent"
                            : "使用者"}
                        </Typography>
                        <Box sx={{ typography: "body2", mt: 0.5 }}>
                          <Markdown>{message.content}</Markdown>
                        </Box>
                      </Paper>
                    ))}
                    {visibleAiResult && (
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <SmartToyIcon color="primary" />
                            <Typography fontWeight={800}>AI 回應</Typography>
                          </Stack>
                          <Button
                            startIcon={<ContentCopyIcon />}
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                visibleAiResult,
                              )
                            }
                          >
                            複製
                          </Button>
                        </Stack>
                        <Box sx={{ typography: "body2", mt: 1 }}>
                          <Markdown>{visibleAiResult}</Markdown>
                        </Box>
                      </Paper>
                    )}
                    {aiMessageTotalPages > 1 && (
                      <Stack direction="row" justifyContent="center">
                        <Pagination
                          size="small"
                          count={aiMessageTotalPages}
                          page={aiMessagePage}
                          onChange={(_, page) => setAiMessagePage(page)}
                          color="primary"
                        />
                      </Stack>
                    )}
                  </>
                ) : (
                  <CustomEmptyState
                    icon={<SmartToyIcon fontSize="large" />}
                    title="還沒有 AI Agent 對話紀錄"
                    description="送出需求後，這份設定集的 AI Agent 對話會顯示在這裡。"
                  />
                )}
              </Stack>

              <Divider />

              <Stack spacing={1.5} sx={{ p: 2 }}>
                <TextField
                  label="輸入需求"
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={8}
                  placeholder="可輸入 @thisLore、@lore:標題 或 @story:標題 引用內容。"
                />
                <Button
                  startIcon={<SendIcon />}
                  variant="contained"
                  onClick={runSelectedAgent}
                  disabled={!canRunAgent}
                >
                  {runAgent.isPending ? "處理中" : "送出需求"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
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
