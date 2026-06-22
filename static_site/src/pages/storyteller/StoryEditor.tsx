import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import HistoryIcon from "@mui/icons-material/History";
import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";
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
  Pagination,
  Paper,
  Radio,
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

export default function StorytellerStoryEditor() {
  const { id, storyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNewStory = storyId === "new";
  const isHistoryRoute = location.pathname.endsWith("/diff");
  const project = storytellerProjects.find((item) => item.id === id);
  const story = storytellerStories.find(
    (item) => item.projectId === id && item.id === storyId,
  );
  const [storyTitle, setStoryTitle] = useState(story?.title ?? "");
  const [storySummary, setStorySummary] = useState(story?.summary ?? "");
  const [tab, setTab] = useState(isHistoryRoute ? "history" : "editor");
  const [content, setContent] = useState(story?.content ?? "");
  const [selectedText, setSelectedText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [saveMessageVisible, setSaveMessageVisible] = useState(false);
  const [leftDiffId, setLeftDiffId] = useState("");
  const [rightDiffId, setRightDiffId] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pageTitle = isNewStory
    ? "建立故事"
    : storyTitle.trim() || story?.title || "未命名故事";
  const storyDiffs = story ? getStoryDiffs(story.id) : [];
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

  useEffect(() => {
    if (isHistoryRoute) {
      setTab("history");
    }
  }, [isHistoryRoute]);

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

    return new Date(diff.createdAt) > new Date(leftDiff.createdAt);
  }

  function handleLeftDiffChange(diffId: string) {
    setLeftDiffId(diffId);
    const selectedLeftDiff = storyDiffs.find((diff) => diff.id === diffId);
    const selectedRightDiff = storyDiffs.find((diff) => diff.id === rightDiffId);

    if (
      !selectedLeftDiff ||
      !selectedRightDiff ||
      selectedRightDiff.id === selectedLeftDiff.id ||
      new Date(selectedRightDiff.createdAt) > new Date(selectedLeftDiff.createdAt)
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
            <Chip label={`更新於 ${formatStorytellerDate(story.updatedAt)}`} />
          ) : (
            <Chip label="尚未存檔" color="warning" />
          )}
        </Stack>
      }
      hideHeading
      headerContent={
        <Stack spacing={2}>
          {saveMessageVisible && (
            <Alert severity="info" variant="outlined">
              目前僅完成前端畫面；存檔將包含故事標題、故事摘要與故事本文。
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
                onClick={() => setSaveMessageVisible(true)}
              >
                存檔
              </Button>
            </Grid>
          </Grid>
        </Stack>
      }
    >
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
                      請先選擇 diff1，再從 diff1 同時間或更早的版本中選擇 diff2。
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
                          <TableCell padding="checkbox">diff1</TableCell>
                          <TableCell padding="checkbox">diff2</TableCell>
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
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SmartToyIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  AI Agent
                </Typography>
              </Stack>
              <TextField select label="使用 Agent" defaultValue={storytellerAgents[0].id}>
                {storytellerAgents.map((agent) => (
                  <MenuItem key={agent.id} value={agent.id}>
                    {agent.name} / {agent.provider}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                multiline
                minRows={8}
                label="提問或指令"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="例如：讀取目前全文，指出節奏太快的段落。"
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  onClick={() => setAiPrompt("請讀取目前完整內容，整理角色動機與潛在矛盾。")}
                >
                  分析全文
                </Button>
                <Button
                  variant="outlined"
                  disabled={!selectedText}
                  onClick={() => setAiPrompt(`請延續這段文字繼續寫下去：\n\n${selectedText}`)}
                >
                  延續選取段落
                </Button>
              </Stack>
              <Divider />
              <Alert severity="info" variant="outlined">
                AI 對話區目前是前端畫面，等待後端 API 與 Agent 設定串接。
              </Alert>
              <Button variant="contained" startIcon={<SmartToyIcon />}>
                送出給 AI Agent
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
