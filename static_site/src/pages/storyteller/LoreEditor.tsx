import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import SaveIcon from "@mui/icons-material/Save";
import SubscriptIcon from "@mui/icons-material/Subscript";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
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
import { StorytellerMarkdownSyntaxDrawer } from "@/pages/storyteller/StorytellerMarkdownSyntaxDrawer.tsx";
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
  resolveStorytellerAgentReferences,
} from "@/pages/storyteller/storytellerAgentReferences.ts";

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
  const [sidePanel, setSidePanel] = useState<StorytellerEditorSidePanel>("ai");
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
  const panelAgents: StorytellerAgentPanelAgent[] = agents.map((agent) => ({
    id: String(agent.id),
    name: agent.name,
    provider: agent.provider,
    model: agent.model_name,
    prompt: agent.default_prompt,
    enabled: !agent.is_deleted,
  }));
  const canRunAgent =
    !isNewLore &&
    Boolean(apiProject?.public_id && apiLore?.public_id && selectedAgent) &&
    !runAgent.isPending;
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
    ...(visibleAiResult
      ? [
          {
            id: `lore-agent-result-${visibleAiResult.length}`,
            role: "assistant" as const,
            content: visibleAiResult,
            speaker: selectedAgent?.name || "AI Agent",
            isCurrentResult: true,
          },
        ]
      : []),
  ];
  const aiMessageTotalPages = Math.max(
    1,
    Math.ceil((aiMessagesPage?.total ?? 0) / aiMessagesPerPage),
  );
  const agentContext = buildStorytellerAgentReferenceContent(loreReferences);
  const loreHistoryItems: StoryEditHistoryItem[] = versions.map((version) => ({
    id: String(version.id),
    title: version.title,
    source: "手動編輯",
    createdAt: version.created_at,
    words: version.word_count,
  }));
  const showSnack = useCallback(
    (message: string, severity: AlertColor = "success") => {
      setSnack(message);
      setSnackSeverity(severity);
    },
    [],
  );

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
  }, [apiProject?.public_id, isNewLore, lore?.id, showSnack]);

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

  function applyAgentText(
    result: string,
    action: "insert" | "append" | "copy",
  ) {
    const text = result.trim();
    if (!text) {
      return;
    }
    const target = textAreaRef.current;
    if (action === "copy") {
      void navigator.clipboard.writeText(text);
      showSnack("AI 回應已複製。");
      return;
    }
    if (action === "append") {
      setContent(
        (value) => `${value}${value.endsWith("\n") ? "" : "\n\n"}${text}`,
      );
      return;
    }
    const cursor = target?.selectionStart ?? content.length;
    setContent(`${content.slice(0, cursor)}${text}${content.slice(cursor)}`);
    window.requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(cursor, cursor + text.length);
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
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 1, overflow: "hidden", p: 2 }}
          >
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
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <StorytellerMarkdownSyntaxDrawer />
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
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 1 }} sx={{ order: { xs: 2, lg: 3 } }}>
          <StorytellerEditorSideTabs
            value={sidePanel}
            onChange={setSidePanel}
            historyDisabled={isNewLore}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }} sx={{ order: { xs: 3, lg: 2 } }}>
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
                <StorytellerMarkdown>{content || " "}</StorytellerMarkdown>
              </Box>
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
                isNewLore ? "設定集第一次存檔後才能呼叫 AI Agent。" : undefined
              }
              emptyTitle="還沒有 AI Agent 對話紀錄"
              emptyDescription="送出需求後，這份設定集的 AI Agent 對話會顯示在這裡。"
              page={aiMessagePage}
              pageCount={aiMessageTotalPages}
              onPageChange={setAiMessagePage}
              prompt={aiPrompt}
              onPromptChange={setAiPrompt}
              promptPlaceholder="可輸入 Markdown。使用 @thisLore、@lore:[標題] 或 @story:[標題] 引用內容。"
              promptExtras={
                loreReferences.length > 0 ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                ) : null
              }
              canRun={canRunAgent}
              onRun={runSelectedAgent}
              onApplyText={(text, action) =>
                applyAgentText(text, action === "replace" ? "insert" : action)
              }
            />
          )}
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
