import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import HistoryIcon from "@mui/icons-material/History";
import AddCommentIcon from "@mui/icons-material/AddComment";
import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SubscriptIcon from "@mui/icons-material/Subscript";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Radio,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useSaveStorytellerStory,
  useStorytellerAgents,
  useStorytellerProjects,
  useStorytellerStoryVersions,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import {
  formatStorytellerDate,
  getStoryDiffs,
  storytellerAgents,
  storytellerProjects,
  storytellerStories,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

const historyPerPage = 5;
const autoSaveIntervalMinutes = 2;

interface EditorProject {
  id: string;
  name: string;
  description: string;
}

interface EditorStory {
  id: string;
  title: string;
  summary: string;
  content: string;
  updatedAt: string;
  sort: number;
}

interface EditorAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  purpose: string;
  enabled: boolean;
}

interface EditorStoryVersion {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  words: number;
}

interface StoryDraft {
  title: string;
  summary: string;
  content: string;
  sort: number;
}

function serializeStoryDraft(title: string, summary: string, content: string) {
  return JSON.stringify({
    title,
    summary,
    content,
  });
}

export default function StorytellerStoryEditor() {
  const { id, storyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNewStory = storyId === "new";
  const isHistoryRoute = location.pathname.endsWith("/diff");
  const { data: apiProjects = [], isPending: apiProjectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const mockProject = storytellerProjects.find((item) => item.id === id);
  const project: EditorProject | undefined = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        description: apiProject.description,
      }
    : mockProject
      ? {
          id: mockProject.id,
          name: mockProject.name,
          description: mockProject.description,
        }
      : undefined;
  const { data: apiStories = [], isPending: apiStoriesPending } =
    useStorytellerStories(apiProject?.public_id);
  const apiStory = apiStories.find((item) => item.public_id === storyId);
  const mockStory = storytellerStories.find(
    (item) => item.projectId === id && item.id === storyId,
  );
  const story: EditorStory | undefined = apiStory
    ? {
        id: apiStory.public_id,
        title: apiStory.title,
        summary: apiStory.summary,
        content: apiStory.latest_content,
        updatedAt: apiStory.updated_at,
        sort: apiStory.sort,
      }
    : mockStory
      ? {
          id: mockStory.id,
          title: mockStory.title,
          summary: mockStory.summary,
          content: mockStory.content,
          updatedAt: mockStory.updatedAt,
          sort: 0,
        }
      : undefined;
  const { data: apiAgents = [] } = useStorytellerAgents();
  const agentRows: EditorAgent[] =
    apiAgents.length > 0
      ? apiAgents.map((agent) => ({
          id: String(agent.id),
          name: agent.name,
          provider: agent.provider,
          model: agent.model_name,
          purpose: agent.default_prompt,
          enabled: !agent.is_deleted,
        }))
      : storytellerAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          provider: agent.provider,
          model: agent.model,
          purpose: agent.purpose,
          enabled: agent.enabled,
        }));
  const saveStory = useSaveStorytellerStory(apiProject?.public_id);
  const { data: apiStoryVersions = [], isLoading: apiStoryVersionsLoading } =
    useStorytellerStoryVersions(apiProject?.public_id, apiStory?.public_id);
  const [storyTitle, setStoryTitle] = useState(story?.title ?? "");
  const [storySummary, setStorySummary] = useState(story?.summary ?? "");
  const [tab, setTab] = useState(isHistoryRoute ? "history" : "editor");
  const [content, setContent] = useState(story?.content ?? "");
  const [selectedText, setSelectedText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState(
    agentRows[0]?.id ?? "",
  );
  const [saveMessageVisible, setSaveMessageVisible] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [leftDiffId, setLeftDiffId] = useState("");
  const [rightDiffId, setRightDiffId] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentDraftRef = useRef(serializeStoryDraft("", "", ""));
  const lastSavedDraftRef = useRef(serializeStoryDraft("", "", ""));
  const latestDraftRef = useRef<StoryDraft>({
    title: "",
    summary: "",
    content: "",
    sort: 0,
  });
  const saveStoryRef = useRef(saveStory);
  const autoSaveRunningRef = useRef(false);
  const pageTitle = isNewStory
    ? "建立故事"
    : storyTitle.trim() || story?.title || "未命名故事";
  const storyDiffs: EditorStoryVersion[] =
    apiStory
      ? apiStoryVersions.map((version) => ({
          id: String(version.id),
          title: version.title,
          source: "手動編輯",
          createdAt: version.created_at,
          words: version.word_count,
        }))
      : story
        ? getStoryDiffs(story.id)
        : [];
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(storyDiffs.length / historyPerPage),
  );
  const visibleStoryDiffs = storyDiffs.slice(
    (historyPage - 1) * historyPerPage,
    historyPage * historyPerPage,
  );
  const comparePath =
    id && storyId && leftDiffId && rightDiffId
      ? `/storyteller/project/${id}/story/${storyId}/diff/${leftDiffId}/${rightDiffId}`
      : "";
  const leftDiff = storyDiffs.find((diff) => diff.id === leftDiffId);
  const selectedAgent =
    agentRows.find((agent) => agent.id === selectedAgentId) ?? agentRows[0];

  useEffect(() => {
    if (isHistoryRoute) {
      setTab("history");
    }
  }, [isHistoryRoute]);

  useEffect(() => {
    setStoryTitle(story?.title ?? "");
    setStorySummary(story?.summary ?? "");
    setContent(story?.content ?? "");
    const savedDraft = serializeStoryDraft(
      story?.title ?? "",
      story?.summary ?? "",
      story?.content ?? "",
    );
    currentDraftRef.current = savedDraft;
    lastSavedDraftRef.current = savedDraft;
  }, [story?.content, story?.summary, story?.title]);

  useEffect(() => {
    currentDraftRef.current = serializeStoryDraft(
      storyTitle,
      storySummary,
      content,
    );
    latestDraftRef.current = {
      title: storyTitle,
      summary: storySummary,
      content,
      sort: story?.sort ?? 0,
    };
  }, [content, story?.sort, storySummary, storyTitle]);

  useEffect(() => {
    saveStoryRef.current = saveStory;
  }, [saveStory]);

  useEffect(() => {
    if (!agentRows.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agentRows[0]?.id ?? "");
    }
  }, [agentRows, selectedAgentId]);

  useTitle(`${pageTitle} - Storyteller`, {
    path:
      id && storyId
        ? `/storyteller/project/${id}/story/${storyId}${isHistoryRoute ? "/diff" : ""}`
        : "",
    robots: "noindex, nofollow",
  });

  const wordCount = useMemo(() => {
    const normalized = content.replace(/\s+/g, "");
    return normalized.length;
  }, [content]);

  useEffect(() => {
    if (!apiProject?.public_id || isNewStory || !story?.id) {
      return;
    }

    const timer = window.setInterval(() => {
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
      saveStoryRef.current.mutate(
        {
          storyPublicId: story.id,
          input: {
            title: latestDraft.title,
            summary: latestDraft.summary,
            sort: latestDraft.sort,
            content: latestDraft.content,
          },
        },
        {
          onSuccess: () => {
            lastSavedDraftRef.current = currentDraft;
            setSaveMessage("已自動存檔。");
            setSaveMessageVisible(true);
          },
          onSettled: () => {
            autoSaveRunningRef.current = false;
          },
        },
      );
    }, autoSaveIntervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [apiProject?.public_id, isNewStory, story?.id]);

  if ((!project && apiProjectsPending) || (apiProject && !isNewStory && !story && apiStoriesPending)) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!project || (!isNewStory && !story)) {
    return <ErrorPage code={404} />;
  }

  function updateSelection() {
    const target = textAreaRef.current;
    if (!target) {
      return;
    }

    const value = target.value.slice(target.selectionStart, target.selectionEnd);
    setSelectedText(value.trim());
  }

  function isRightDiffDisabled(diffId: string) {
    const diff = storyDiffs.find((item) => item.id === diffId);
    if (!leftDiff || !diff || diff.id === leftDiff.id) {
      return true;
    }

    return new Date(diff.createdAt) <= new Date(leftDiff.createdAt);
  }

  function handleLeftDiffChange(diffId: string) {
    setLeftDiffId(diffId);
    const selectedLeftDiff = storyDiffs.find((diff) => diff.id === diffId);
    const selectedRightDiff = storyDiffs.find((diff) => diff.id === rightDiffId);

    if (
      !selectedLeftDiff ||
      !selectedRightDiff ||
      selectedRightDiff.id === selectedLeftDiff.id ||
      new Date(selectedRightDiff.createdAt) <= new Date(selectedLeftDiff.createdAt)
    ) {
      setRightDiffId("");
    }
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
    const selected = content.slice(start, end);
    const fallback = selected || "文字";
    const replacements = {
      bold: `**${fallback}**`,
      italic: `*${fallback}*`,
      subscript: `<sub>${fallback}</sub>`,
      left: `<div align="left">\n${fallback}\n</div>`,
      center: `<div align="center">\n${fallback}\n</div>`,
      right: `<div align="right">\n${fallback}\n</div>`,
    };
    const nextContent = `${content.slice(0, start)}${replacements[type]}${content.slice(end)}`;

    setContent(nextContent);
    window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start, start + replacements[type].length);
      updateSelection();
    });
  }

  function handleTabChange(value: string) {
    setTab(value);

    if (!id || !storyId || isNewStory) {
      return;
    }

    const editorPath = `/storyteller/project/${id}/story/${storyId}`;
    const historyPath = `${editorPath}/diff`;

    if (value === "history" && location.pathname !== historyPath) {
      navigate(historyPath);
    } else if (value !== "history" && location.pathname === historyPath) {
      navigate(editorPath);
    }
  }

  function handleSaveStory() {
    if (!apiProject?.public_id) {
      lastSavedDraftRef.current = currentDraftRef.current;
      setSaveMessage("目前使用前端假資料，未送出到後端 API。");
      setSaveMessageVisible(true);
      return;
    }

    saveStory.mutate(
      {
        storyPublicId: isNewStory ? undefined : story?.id,
        input: {
          title: storyTitle,
          summary: storySummary,
          sort: story?.sort ?? 0,
          content,
        },
      },
      {
        onSuccess: (savedStory) => {
          lastSavedDraftRef.current = currentDraftRef.current;
          setSaveMessage("故事已存檔。");
          setSaveMessageVisible(true);
          if (isNewStory && savedStory?.public_id) {
            navigate(`/storyteller/project/${id}/story/${savedStory.public_id}`);
          }
        },
      },
    );
  }

  return (
    <StorytellerShell
      title={pageTitle}
      description={
        isNewStory
          ? "建立新的故事草稿。第一次存檔後，後續會切換到正式故事編輯路由。"
          : "編輯故事基本資訊、本文與版本歷史。"
      }
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表", to: "/storyteller/project" },
        { label: project.name, to: `/storyteller/project/${project.id}` },
        { label: pageTitle },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${wordCount.toLocaleString()} 字`} />
          {story ? (
            <>
              <Chip label={`更新於 ${formatStorytellerDate(story.updatedAt)}`} />
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
          {saveStory.isError && (
            <Alert severity="error" variant="outlined">
              存檔失敗，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={12}>
              <TextField
                required
                fullWidth
                label="故事標題"
                value={storyTitle}
                onChange={(event) => setStoryTitle(event.target.value)}
                placeholder="請輸入故事標題"
                helperText="列表與編輯頁標題以此欄位為主。"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 10 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="故事摘要"
                value={storySummary}
                onChange={(event) => setStorySummary(event.target.value)}
                placeholder="簡短描述這篇故事的重點、章節目的或目前狀態。"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SaveIcon />}
                sx={{ py: 1.7 }}
                disabled={saveStory.isPending}
                onClick={handleSaveStory}
              >
                {saveStory.isPending ? "存檔中" : "存檔"}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      }
    >
      <Snackbar
        open={saveMessageVisible}
        autoHideDuration={2000}
        onClose={() => setSaveMessageVisible(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={apiProject ? "success" : "info"}
          variant="filled"
          onClose={() => setSaveMessageVisible(false)}
          sx={{ width: "100%" }}
        >
          {saveMessage}
        </Alert>
      </Snackbar>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              sx={{ px: 2, py: 1.5 }}
            >
              <Tabs value={tab} onChange={(_, value) => handleTabChange(value)}>
                <Tab value="editor" label="文字編輯" />
                <Tab value="preview" label="預覽" />
                <Tab value="history" label="編輯歷史" />
              </Tabs>
            </Stack>
            <Divider />

            {selectedText && tab === "editor" && (
              <Alert
                severity="info"
                variant="outlined"
                icon={<AutoFixHighIcon />}
                sx={{ m: 2 }}
                action={
                  <Button
                    size="small"
                    onClick={() =>
                      setAiPrompt(`請針對這段文字提供三種改寫版本：\n\n${selectedText}`)
                    }
                  >
                    改寫
                  </Button>
                }
              >
                已選取 {selectedText.length} 個字，可呼叫 AI Agent 改寫。
              </Alert>
            )}

            <Box sx={{ display: tab === "editor" ? "block" : "none", p: 2 }}>
              <Paper
                variant="outlined"
                sx={{ p: 1, mb: 2, borderRadius: 1, bgcolor: "background.default" }}
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
                  <Tooltip title="使用 AI 改寫選取文字">
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={!selectedText}
                        onClick={() =>
                          setAiPrompt(
                            `請改寫以下段落，保留原本語氣：\n\n${selectedText}`,
                          )
                        }
                      >
                        <AutoFixHighIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="預覽">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleTabChange("preview")}
                    >
                      <PreviewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
              <TextField
                fullWidth
                multiline
                label="故事內容"
                minRows={22}
                value={content}
                inputRef={textAreaRef}
                onChange={(event) => setContent(event.target.value)}
                onSelect={updateSelection}
                onKeyUp={updateSelection}
                onMouseUp={updateSelection}
                placeholder="使用 Markdown 撰寫故事內容"
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
                }}
              >
                <Markdown>{content}</Markdown>
              </Box>
            </Box>

            <Box sx={{ display: tab === "history" ? "block" : "none", p: 2 }}>
              {isNewStory ? (
                <Alert severity="info" variant="outlined">
                  新故事第一次存檔後才會產生編輯歷史。
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {apiStoryVersionsLoading && (
                    <Stack alignItems="center" sx={{ py: 2 }}>
                      <CircularProgress size={24} />
                    </Stack>
                  )}
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Typography color="text.secondary">
                      選擇兩個版本後可以比對標題與 Markdown 內容差異。
                    </Typography>
                    <Button
                      href={comparePath || undefined}
                      disabled={!comparePath}
                      variant="contained"
                      startIcon={<CompareArrowsIcon />}
                    >
                      比對選取版本
                    </Button>
                  </Stack>

                  {(!leftDiffId || !rightDiffId) && (
                    <Alert severity="info" variant="outlined">
                      請先選擇較舊的 diff1，再從 diff1 更新的版本中選擇 diff2。
                    </Alert>
                  )}

                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ borderRadius: 1 }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">diff1<br />舊</TableCell>
                          <TableCell padding="checkbox">diff2<br />新</TableCell>
                          <TableCell>版本</TableCell>
                          <TableCell>來源</TableCell>
                          <TableCell>字數</TableCell>
                          <TableCell>建立時間</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleStoryDiffs.map((diff) => (
                          <TableRow
                            key={diff.id}
                            hover
                            selected={
                              leftDiffId === diff.id || rightDiffId === diff.id
                            }
                          >
                            <TableCell padding="checkbox">
                              <Radio
                                checked={leftDiffId === diff.id}
                                onChange={() => handleLeftDiffChange(diff.id)}
                                inputProps={{ "aria-label": `選擇 ${diff.id} 作為 diff1` }}
                              />
                            </TableCell>
                            <TableCell padding="checkbox">
                              <Radio
                                checked={rightDiffId === diff.id}
                                disabled={isRightDiffDisabled(diff.id)}
                                onChange={() => setRightDiffId(diff.id)}
                                inputProps={{ "aria-label": `選擇 ${diff.id} 作為 diff2` }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={1.5}
                                alignItems="center"
                              >
                                <HistoryIcon color="primary" />
                                <Stack spacing={0.5}>
                                  <Typography fontWeight={800}>
                                    {diff.title}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {diff.id}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={diff.source} />
                            </TableCell>
                            <TableCell>{diff.words.toLocaleString()}</TableCell>
                            <TableCell>
                              {formatStorytellerDate(diff.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Stack direction="row" justifyContent="center">
                    <Pagination
                      count={totalHistoryPages}
                      page={historyPage}
                      onChange={(_, page) => setHistoryPage(page)}
                      color="primary"
                      showFirstButton
                      showLastButton
                    />
                  </Stack>
                </Stack>
              )}
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
            <Stack sx={{ minHeight: { lg: 720 } }}>
              <Stack
                spacing={1.5}
                sx={{ p: 2, bgcolor: "background.default" }}
              >
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
                    value={selectedAgentId}
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                    sx={{ flex: 1, minWidth: 180 }}
                  >
                    {agentRows.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={selectedAgent.enabled ? "可用" : "停用"}
                    color={selectedAgent.enabled ? "success" : "default"}
                  />
                  <Chip size="small" label={selectedAgent.provider} />
                  <Chip size="small" label={selectedAgent.model} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedAgent.purpose}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddCommentIcon />}
                  >
                    new chat
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                  >
                    history
                  </Button>
                </Stack>
              </Stack>

              <Divider />

              <Stack
                spacing={1.5}
                sx={{
                  p: 2,
                  flex: 1,
                  overflowY: "auto",
                  bgcolor: "grey.50",
                }}
              >
                <Box
                  sx={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {selectedAgent.name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    我會依照目前選擇的 Agent 用途協助處理故事內容。你可以直接輸入需求，也可以貼上 Markdown。
                  </Typography>
                </Box>
                <Box
                  sx={{
                    alignSelf: "flex-end",
                    maxWidth: "92%",
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    使用者
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    **先幫我看第一章開場是否需要增加懸疑感。**
                  </Typography>
                </Box>
                <Box
                  sx={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {selectedAgent.name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <Markdown>
                      {
                        "目前開場的城市氣氛足夠明確，可以把 **石龕** 與 **河面發光** 之間的因果再拉遠一點，讓讀者先感到不對勁。"
                      }
                    </Markdown>
                  </Typography>
                </Box>
              </Stack>

              <Divider />

              <Stack spacing={1.5} sx={{ p: 2 }}>
                <TextField
                  multiline
                  minRows={4}
                  label="輸入需求"
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="可輸入 Markdown，例如：請用 **條列式** 指出目前章節需要補強的地方。"
                />
                {aiPrompt.trim() && (
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Markdown 預覽
                    </Typography>
                    <Box sx={{ typography: "body2", mt: 0.5 }}>
                      <Markdown>{aiPrompt}</Markdown>
                    </Box>
                  </Paper>
                )}
                <Button variant="contained" startIcon={<SendIcon />}>
                  送出需求
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
