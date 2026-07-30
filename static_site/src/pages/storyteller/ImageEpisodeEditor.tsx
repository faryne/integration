import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import EditNoteIcon from "@mui/icons-material/EditNote";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  usePresignStorytellerImageUpload,
  useSaveStorytellerStory,
  useStorytellerImageStoryPages,
  useStorytellerProjects,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import {
  STORYTELLER_APP_NAME,
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
  STORYTELLER_IMAGE_PAGE_MAX_COUNT,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";

interface PendingPage {
  id: string;
  // 編輯既有話時載入進來的頁面沒有本機 File——已經在 S3 上了，只有使用者新增的
  // 頁面才有；上傳時只挑「有 file 但還沒 uploadedKey」的頁面來傳。
  file?: File;
  previewUrl: string;
  description: string;
  // 這一頁成功上傳到 S3 後記錄下來的 object key；既有頁面載入當下就有，
  // 重試時也用這個判斷哪些頁不用重新上傳。
  uploadedKey?: string;
}

// 同時間最多幾個上傳中的 PUT 請求，避免使用者一次選幾十張圖時全部同時發出去。
const uploadConcurrency = 3;

export default function StorytellerImageEpisodeEditor() {
  const { id, episodeId } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const {
    data: projects = [],
    isLoading,
    isFetching,
  } = useStorytellerProjects();
  const project = projects.find((item) => item.public_id === id);
  const isNewEpisode = !episodeId || episodeId === "new";

  const { data: apiStories = [], isLoading: isStoriesLoading } =
    useStorytellerStories(!isNewEpisode ? project?.public_id : undefined);
  const existingStory = !isNewEpisode
    ? apiStories.find((story) => story.public_id === episodeId)
    : undefined;
  const {
    data: existingPages = [],
    isLoading: isPagesLoading,
    isSuccess: isPagesLoaded,
  } = useStorytellerImageStoryPages(
    !isNewEpisode ? project?.public_id : undefined,
    !isNewEpisode ? episodeId : undefined,
  );

  const saveStory = useSaveStorytellerStory(project?.public_id);
  const presignUpload = usePresignStorytellerImageUpload(project?.public_id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"draft" | "completed">("completed");
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [progress, setProgress] = useState<
    Record<string, { loaded: number; total: number }>
  >({});
  const [phase, setPhase] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  // 編輯既有話時，existingStory／existingPages 都載入完成才把資料灌進表單一次；
  // 之後使用者自己編輯的內容不能被這個 effect 再蓋回去，所以只做一次。
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isNewEpisode || initialized || !existingStory || !isPagesLoaded) {
      return;
    }
    setTitle(existingStory.title);
    setSummary(existingStory.summary);
    setStatus(existingStory.status);
    setPages(
      existingPages.map((page) => ({
        id: page.id,
        previewUrl: page.image_url,
        description: page.description,
        uploadedKey: page.key,
      })),
    );
    setInitialized(true);
  }, [isNewEpisode, initialized, existingStory, existingPages, isPagesLoaded]);

  // 只在卸載時清理，不隨 pages 變動重跑（否則每次新增頁面都會把舊的 URL 一併撤銷）。
  // 既有頁面的 previewUrl 是遠端網址不是 blob URL，revokeObjectURL 對它是安全的
  // no-op，不用特別排除。
  useEffect(() => {
    return () => {
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    };
  }, []);

  // 上傳中重新整理或關閉分頁需要噴出確認對話框——只擋瀏覽器層級的離開，
  // App 內路由切換的攔截這次不做。
  useEffect(() => {
    if (phase !== "uploading") {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  const pageTitle = isNewEpisode ? "上傳圖像作品" : "編輯圖像作品";

  useTitle(`${pageTitle} | ${STORYTELLER_APP_NAME}`, {
    path:
      id && episodeId
        ? steamloomPath(`my/project/${id}/image/${episodeId}`)
        : undefined,
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
            to: steamloomPath(`my/project/${project.public_id}/images`),
          },
        ]
      : []),
    { label: pageTitle },
  ];

  if (authLoading) {
    return (
      <StorytellerShell title={pageTitle} breadcrumbs={shellBreadcrumbs}>
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell title={pageTitle} breadcrumbs={shellBreadcrumbs}>
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
      <StorytellerShell title={pageTitle} breadcrumbs={shellBreadcrumbs}>
        <StorytellerLoading label="正在載入專案資料..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  if (!isNewEpisode && !initialized) {
    if (isStoriesLoading || isPagesLoading) {
      return (
        <StorytellerShell title={pageTitle} breadcrumbs={shellBreadcrumbs}>
          <StorytellerLoading label="正在載入話的資料..." />
        </StorytellerShell>
      );
    }
    if (!existingStory || existingStory.content_type !== "image") {
      return <ErrorPage code={404} />;
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }
    const files = Array.from(fileList);
    const rejectedType = files.some(
      (file) => !STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type),
    );
    const rejectedSize = files.some(
      (file) => file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const accepted = files.filter(
      (file) =>
        STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type) &&
        file.size <= STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const overCount =
      pages.length + accepted.length - STORYTELLER_IMAGE_PAGE_MAX_COUNT;
    const withinLimit =
      overCount > 0 ? accepted.slice(0, -overCount) : accepted;

    if (rejectedType || rejectedSize || overCount > 0) {
      const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);
      const reasons = [
        rejectedType && "只接受 JPEG／PNG／WebP／GIF 圖片檔",
        rejectedSize && `單張檔案不能超過 ${maxMB}MB`,
        overCount > 0 && `一話最多 ${STORYTELLER_IMAGE_PAGE_MAX_COUNT} 頁`,
      ].filter(Boolean);
      setFileWarning(`部分檔案未加入：${reasons.join("、")}`);
    } else {
      setFileWarning(null);
    }

    const nextPages = withinLimit.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      description: "",
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

  function updatePageDescription(pageId: string, description: string) {
    setPages((current) =>
      current.map((page) =>
        page.id === pageId ? { ...page, description } : page,
      ),
    );
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
    setPhase("uploading");
    setUploadError(null);
    try {
      // 只上傳還沒成功過的頁面——重試時已經上傳好的頁面不用重來。
      const pendingIndexes = pages
        .map((page, index) => (page.uploadedKey ? null : index))
        .filter((index): index is number => index !== null);

      // resolvedKeys 是函式內的本地變數，不能靠讀 pages state 組最後的 content——
      // 同一次函式執行內看不到自己剛 setPages 寫回去的結果，會讀到舊的快照。
      const resolvedKeys = pages.map((page) => page.uploadedKey);

      if (pendingIndexes.length > 0) {
        const uploads = await presignUpload.mutateAsync(
          pendingIndexes.map((pageIndex) => pages[pageIndex].file!.type),
        );
        let cursor = 0;
        async function worker() {
          while (cursor < pendingIndexes.length) {
            const uploadIndex = cursor++;
            const pageIndex = pendingIndexes[uploadIndex];
            const page = pages[pageIndex];
            const target = uploads[uploadIndex];
            // pendingIndexes 只挑「沒有 uploadedKey」的頁面，這種頁面一定是透過
            // addFiles 新增的、一定有 file——既有頁面載入時就帶著 uploadedKey，
            // 不會落在這裡；這裡防禦性擋一下，避免資料流一旦出錯就整支炸掉。
            if (!page.file) {
              continue;
            }
            const file = page.file;
            await axios.put(target.upload_url, file, {
              headers: { "Content-Type": file.type },
              onUploadProgress: (event) => {
                setProgress((current) => ({
                  ...current,
                  [page.id]: {
                    loaded: event.loaded,
                    total: event.total ?? file.size,
                  },
                }));
              },
            });
            resolvedKeys[pageIndex] = target.key;
            setPages((current) =>
              current.map((item, index) =>
                index === pageIndex
                  ? { ...item, uploadedKey: target.key }
                  : item,
              ),
            );
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(uploadConcurrency, pendingIndexes.length) },
            worker,
          ),
        );
      }

      const content = JSON.stringify({
        pages: pages.map((page, index) => ({
          id: page.id,
          key: resolvedKeys[index],
          description: page.description,
          sort: index,
        })),
      });

      await saveStory.mutateAsync({
        storyPublicId: existingStory?.public_id,
        input: {
          title: title.trim(),
          summary: summary.trim(),
          status,
          sort: existingStory?.sort ?? 0,
          content,
          content_type: "image",
        },
      });

      setPhase("idle");
      navigate(steamloomPath(`my/project/${project.public_id}/images`));
    } catch (error) {
      setPhase("error");
      setUploadError(
        error instanceof Error ? error.message : "上傳失敗，請重試。",
      );
    }
  }

  const editingPage = pages.find((page) => page.id === editingPageId) ?? null;
  const editingPageIndex = editingPage ? pages.indexOf(editingPage) : -1;

  // 既有頁面（沒有本機 file）不需要上傳，size 算 0，不會被計進總體進度裡。
  const totalBytes = pages.reduce(
    (sum, page) => sum + (page.file?.size ?? 0),
    0,
  );
  const uploadedBytes = pages.reduce((sum, page) => {
    if (page.uploadedKey) {
      return sum + (page.file?.size ?? 0);
    }
    const pageProgress = progress[page.id];
    return sum + (pageProgress?.loaded ?? 0);
  }, 0);
  const overallPercent =
    totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const isSubmitting = phase === "uploading";

  return (
    <StorytellerShell title={pageTitle} breadcrumbs={shellBreadcrumbs}>
      <Stack spacing={2}>
        {phase === "error" && uploadError && (
          <Alert severity="error" variant="outlined">
            {uploadError}
          </Alert>
        )}
        {fileWarning && (
          <Alert
            severity="warning"
            variant="outlined"
            onClose={() => setFileWarning(null)}
          >
            {fileWarning}
          </Alert>
        )}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={3}>
            <TextField
              required
              fullWidth
              label="話名稱"
              placeholder="例如：第一話　序章"
              value={title}
              disabled={isSubmitting}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={12}
              label="基本描述"
              placeholder="這段文字給讀者看，簡短描述這一話的重點、劇情或目前狀態。"
              value={summary}
              disabled={isSubmitting}
              onChange={(event) => setSummary(event.target.value)}
            />
            <TextField
              fullWidth
              select
              label="話狀態"
              value={status}
              disabled={isSubmitting}
              onChange={(event) =>
                setStatus(event.target.value as "draft" | "completed")
              }
              helperText="未公開的話不會出現在公開閱讀頁與作品索引。"
            >
              <MenuItem value="draft">未公開</MenuItem>
              <MenuItem value="completed">公開中</MenuItem>
            </TextField>
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
                  accept={STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.join(",")}
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
                      onClick={() => setEditingPageId(page.id)}
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
                      <EditNoteIcon
                        fontSize="small"
                        sx={{
                          position: "absolute",
                          right: 4,
                          bottom: 4,
                          color: page.description.trim()
                            ? "success.light"
                            : "#fff",
                          bgcolor: "rgba(0,0,0,0.6)",
                          borderRadius: 0.5,
                        }}
                      />
                      <IconButton
                        size="small"
                        disabled={isSubmitting}
                        onClick={(event) => {
                          event.stopPropagation();
                          removePage(page.id);
                        }}
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
            {phase !== "idle" && pages.length > 0 && (
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <Typography variant="subtitle2">總體上傳進度</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {overallPercent}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={overallPercent}
                  sx={{ mb: 2 }}
                />
                <Stack spacing={1}>
                  {pages.map((page, index) => {
                    const pageProgress = progress[page.id];
                    const percent = page.uploadedKey
                      ? 100
                      : pageProgress
                        ? Math.round(
                            (pageProgress.loaded / pageProgress.total) * 100,
                          )
                        : 0;
                    return (
                      <Box key={page.id}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 0.25 }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            第 {index + 1} 頁
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {percent}%
                          </Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={percent} />
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                href={steamloomPath(`my/project/${project.public_id}/images`)}
                variant="text"
                disabled={isSubmitting}
              >
                返回列表
              </Button>
              <Button
                variant="contained"
                startIcon={<CollectionsIcon />}
                disabled={!title.trim() || pages.length === 0 || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting
                  ? "處理中..."
                  : phase === "error"
                    ? "重試"
                    : isNewEpisode
                      ? "上傳"
                      : "儲存"}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <Dialog
        open={editingPage !== null}
        onClose={() => setEditingPageId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>第 {editingPageIndex + 1} 頁描述</DialogTitle>
        <DialogContent>
          {editingPage && (
            <Box sx={{ minHeight: 320, mt: 1 }}>
              <StorytellerWysiwygEditor
                value={editingPage.description}
                onChange={(markdown) =>
                  updatePageDescription(editingPage.id, markdown)
                }
                enabledFeatures={[]}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPageId(null)}>完成</Button>
        </DialogActions>
      </Dialog>
    </StorytellerShell>
  );
}
