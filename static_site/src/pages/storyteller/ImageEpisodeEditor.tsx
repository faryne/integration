import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStorytellerProjects } from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { saveImageEpisode } from "@/pages/storyteller/storytellerImageEpisodeMock.ts";

interface PendingPage {
  id: string;
  file: File;
  previewUrl: string;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const maxTagCount = 12;
const maxTagLength = 24;

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .flatMap((tag) => tag.split(/[,，]/))
        .map((tag) => tag.trim().slice(0, maxTagLength))
        .filter(Boolean),
    ),
  ).slice(0, maxTagCount);
}

export default function StorytellerImageEpisodeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const {
    data: projects = [],
    isLoading,
    isFetching,
  } = useStorytellerProjects();
  const project = projects.find((item) => item.public_id === id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState("");
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 只在卸載時清理，不隨 pages 變動重跑（否則每次新增頁面都會把舊的 URL 一併撤銷）。
  useEffect(() => {
    return () => {
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    };
  }, []);

  useTitle(`上傳圖像作品 | ${STORYTELLER_APP_NAME}`, {
    path: id ? steamloomPath(`my/project/${id}/image/new`) : undefined,
    robots: "noindex, nofollow",
  });

  const shellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: "我的工作台", to: steamloomPath("my") },
    { label: "創作專案", to: steamloomPath("my/project") },
    ...(project
      ? [
          {
            label: project.name,
            to: steamloomPath(`my/project/${project.public_id}`),
          },
        ]
      : []),
    { label: "上傳圖像作品" },
  ];

  if (authLoading) {
    return (
      <StorytellerShell title="上傳圖像作品" breadcrumbs={shellBreadcrumbs}>
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell title="上傳圖像作品" breadcrumbs={shellBreadcrumbs}>
        <CustomLoginRequiredState
          description="登入後即可上傳圖像作品。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (!project && (isLoading || isFetching)) {
    return (
      <StorytellerShell title="上傳圖像作品" breadcrumbs={shellBreadcrumbs}>
        <StorytellerLoading label="正在載入專案資料..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }
    const nextPages = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    setPages((current) => [...current, ...nextPages]);
  }

  function removePage(pageId: string) {
    setPages((current) => {
      const target = current.find((page) => page.id === pageId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((page) => page.id !== pageId);
    });
  }

  function movePage(fromIndex: number, toIndex: number) {
    setPages((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleSubmit() {
    if (!project || !title.trim() || pages.length === 0) {
      return;
    }
    setSaving(true);
    const pageDataUrls = await Promise.all(
      pages.map((page) => readAsDataURL(page.file)),
    );
    const pendingTag = tagInputValue.trim();
    saveImageEpisode({
      projectId: project.public_id,
      title: title.trim(),
      summary: summary.trim(),
      tags: normalizeTags(pendingTag ? [...tags, pendingTag] : tags),
      pageDataUrls,
    });
    navigate(steamloomPath(`my/project/${project.public_id}`));
  }

  return (
    <StorytellerShell title="上傳圖像作品" breadcrumbs={shellBreadcrumbs}>
      <Stack spacing={2}>
        <Alert severity="info" variant="outlined">
          這個頁面只是上傳流程的
          mockup：圖片不會真的上傳到伺服器，只存在這台裝置的瀏覽器裡，用來驗證操作流程與畫面，之後接上真正的後端會整個換掉。
        </Alert>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={3}>
            <TextField
              required
              fullWidth
              label="話名稱"
              placeholder="例如：第一話　序章"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={12}
              label="基本描述"
              placeholder="簡短描述這一話的重點、劇情或目前狀態。"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
            <Autocomplete
              multiple
              freeSolo
              fullWidth
              options={[]}
              value={tags}
              inputValue={tagInputValue}
              onInputChange={(_, newInputValue, reason) => {
                if (reason === "input" && /[,，]/.test(newInputValue)) {
                  const segments = newInputValue.split(/[,，]/);
                  const remainder = segments.pop() ?? "";
                  setTags((current) =>
                    normalizeTags([...current, ...segments]),
                  );
                  setTagInputValue(remainder.trimStart());
                  return;
                }
                setTagInputValue(newInputValue);
              }}
              onChange={(_, newValue) => setTags(normalizeTags(newValue))}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    size="small"
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="標籤"
                  helperText={`跟專案的標籤是分開的兩組。輸入後按 Enter，或用「,」「，」分隔新增多個，最多 ${maxTagCount} 個，每個最多 ${maxTagLength} 字。`}
                  placeholder={tags.length === 0 ? "分鏡, 全彩, 短篇" : ""}
                />
              )}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                頁面（{pages.length} 頁）
              </Typography>
              <Box
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: "2px dashed",
                  borderColor: dragOver ? "primary.main" : "divider",
                  borderRadius: 1,
                  p: 4,
                  textAlign: "center",
                  cursor: "pointer",
                  bgcolor: dragOver ? "action.hover" : "transparent",
                }}
              >
                <UploadFileIcon
                  color={dragOver ? "primary" : "disabled"}
                  fontSize="large"
                />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  拖曳圖片到這裡，或點擊選擇檔案（可一次選多張，支援批次上傳）
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => addFiles(event.target.files)}
                />
              </Box>
              {pages.length > 0 && (
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  useFlexGap
                  spacing={1.5}
                  sx={{ mt: 2 }}
                >
                  {pages.map((page, index) => (
                    <Paper
                      key={page.id}
                      variant="outlined"
                      draggable
                      onDragStart={() => setDraggingIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggingIndex !== null && draggingIndex !== index) {
                          movePage(draggingIndex, index);
                        }
                        setDraggingIndex(null);
                      }}
                      sx={{
                        position: "relative",
                        width: 120,
                        height: 160,
                        overflow: "hidden",
                        cursor: "grab",
                        opacity: draggingIndex === index ? 0.4 : 1,
                      }}
                    >
                      <Box
                        component="img"
                        src={page.previewUrl}
                        alt={`第 ${index + 1} 頁`}
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          position: "absolute",
                          left: 4,
                          bottom: 4,
                          px: 0.5,
                          bgcolor: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          borderRadius: 0.5,
                        }}
                      >
                        {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => removePage(page.id)}
                        sx={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          bgcolor: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                        }}
                      >
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                href={steamloomPath(`my/project/${project.public_id}`)}
                variant="text"
              >
                返回列表
              </Button>
              <Button
                variant="contained"
                startIcon={<CollectionsIcon />}
                disabled={!title.trim() || pages.length === 0 || saving}
                onClick={() => void handleSubmit()}
              >
                建立話（Mockup）
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </StorytellerShell>
  );
}
