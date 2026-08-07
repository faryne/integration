import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import EditNoteIcon from "@mui/icons-material/EditNote";
import FolderIcon from "@mui/icons-material/Folder";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useSaveStorytellerStory,
  useStorytellerImageStoryPages,
  useStorytellerProjects,
  useStorytellerStories,
  useStorytellerVolumes,
  useUploadStorytellerAssets,
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
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSelectButton,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { registerWorkspaceLeaveGuard } from "@/pages/storyteller/WorkspaceLeaveGuard.ts";
import type { StorytellerAsset } from "@/types/storyteller.ts";

interface PendingPage {
  id: string;
  // 編輯既有話時載入進來的頁面沒有本機 File——已經在 S3 上了，只有使用者新增的
  // 頁面才有；上傳時只挑「有 file 但還沒 uploadedKey」的頁面來傳。
  file?: File;
  previewUrl: string;
  description: string;
  // 新流程以資產 public id 串接圖像頁；舊資料仍可能只有 uploadedKey。
  assetPublicId?: string;
  // 這一頁成功上傳到 S3 後記錄下來的 object key；既有頁面載入當下就有，
  // 重試時也用這個判斷哪些頁不用重新上傳。
  uploadedKey?: string;
}

// 離開頁面前示警用的頁面快照——File 物件本身不能拿去比對（同一個 File 物件
// JSON.stringify 只會得到 {}），改用「檔名+大小」或已經上傳好的 asset id／key
// 當作這一頁的識別依據，加上頁面說明文字，足以判斷「頁面清單有沒有實質變動」。
function pendingPageSignature(page: PendingPage) {
  const source =
    page.assetPublicId ??
    page.uploadedKey ??
    (page.file ? `${page.file.name}:${page.file.size}` : "");
  return `${source}|${page.description}`;
}

function serializeEpisodeDraft(
  title: string,
  summary: string,
  status: "draft" | "completed",
  selectedVolumeId: string,
  pages: PendingPage[],
) {
  return JSON.stringify({
    title,
    summary,
    status,
    selectedVolumeId,
    pages: pages.map(pendingPageSignature),
  });
}

// 標題空白又一張圖都沒加，就算跟初始狀態不同也不用示警——沒有東西值得保護。
function isEpisodeDraftEmpty(title: string, pages: PendingPage[]) {
  return title.trim() === "" && pages.length === 0;
}

export interface StorytellerImageEpisodeEditorProps {
  embedded?: boolean;
  projectId?: string;
  episodePublicId?: string;
}

export default function StorytellerImageEpisodeEditor({
  embedded = false,
  projectId,
  episodePublicId,
}: StorytellerImageEpisodeEditorProps = {}) {
  const params = useParams();
  const id = projectId ?? params.id;
  const episodeId = episodePublicId ?? params.episodeId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 從工作台指定冊上傳新話時，工作台會在網址帶上 ?from=<volumePublicId>，
  // 預設把新話放進使用者當下瀏覽的那一冊。
  const defaultVolumeIdFromQuery = searchParams.get("from") ?? "";
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
  const { data: apiVolumes = [], isLoading: isVolumesLoading } =
    useStorytellerVolumes(project?.public_id);
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
  const uploadAssets = useUploadStorytellerAssets(project?.public_id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"draft" | "completed">("completed");
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [progress, setProgress] = useState<
    Record<string, { loaded: number; total: number }>
  >({});
  const [phase, setPhase] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  // 編輯既有話時，existingStory／existingPages 都載入完成才把資料灌進表單一次；
  // 之後使用者自己編輯的內容不能被這個 effect 再蓋回去，所以只做一次。
  const [initialized, setInitialized] = useState(false);
  // 離開頁面前示警用的「已存檔」快照——新建話時維持初始空白值即可；編輯既有話
  // 時等下面的 hydration effect 把資料灌進表單後，一併把這個 ref 設成同一份資料，
  // 不能靠讀 title／pages 這些 state，同一個 effect 內看不到自己剛 setState 的結果。
  const lastSavedDraftRef = useRef(
    serializeEpisodeDraft("", "", "completed", "", []),
  );

  useEffect(() => {
    if (isNewEpisode || initialized || !existingStory || !isPagesLoaded) {
      return;
    }
    const parentVolume = apiVolumes.find(
      (volume) => volume.id === existingStory.parent_id,
    );
    if (existingStory.parent_id !== null && !parentVolume && isVolumesLoading) {
      return;
    }
    const hydratedPages = existingPages.map((page) => ({
      id: page.id,
      previewUrl: page.image_url,
      description: page.description,
      assetPublicId: page.asset_public_id,
      uploadedKey: page.key,
    }));
    setTitle(existingStory.title);
    setSummary(existingStory.summary);
    setStatus(existingStory.status);
    setSelectedVolumeId(parentVolume?.public_id ?? "");
    setPages(hydratedPages);
    lastSavedDraftRef.current = serializeEpisodeDraft(
      existingStory.title,
      existingStory.summary,
      existingStory.status,
      parentVolume?.public_id ?? "",
      hydratedPages,
    );
    setInitialized(true);
  }, [
    apiVolumes,
    isNewEpisode,
    initialized,
    existingStory,
    existingPages,
    isPagesLoaded,
    isVolumesLoading,
  ]);

  useEffect(() => {
    if (!isNewEpisode || !defaultVolumeIdFromQuery) {
      return;
    }
    const defaultVolume = apiVolumes.find(
      (volume) => volume.public_id === defaultVolumeIdFromQuery,
    );
    if (defaultVolume) {
      setSelectedVolumeId(defaultVolume.public_id);
    }
  }, [isNewEpisode, defaultVolumeIdFromQuery, apiVolumes]);

  // 只在卸載時清理，不隨 pages 變動重跑（否則每次新增頁面都會把舊的 URL 一併撤銷）。
  // 既有頁面的 previewUrl 是遠端網址不是 blob URL，revokeObjectURL 對它是安全的
  // no-op，不用特別排除。
  useEffect(() => {
    return () => {
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    };
  }, []);

  // 判斷「有沒有值得保護的未存檔變更」——上傳中一定算（半途離開會弄丟已經在傳的
  // 檔案）；沒在上傳時，只在「跟上次存檔的版本不同」且「標題跟頁面不是兩個都
  // 空白」才算。beforeunload（瀏覽器層級離開）跟工作台的 leave guard（App 內
  // 「回列表」／側邊欄切換）共用同一份邏輯，不要各自重算一次。
  function hasUnsavedEpisodeChanges() {
    if (phase === "uploading") {
      return true;
    }
    const currentDraft = serializeEpisodeDraft(
      title,
      summary,
      status,
      selectedVolumeId,
      pages,
    );
    const isDirty = currentDraft !== lastSavedDraftRef.current;
    const isEmpty = isEpisodeDraftEmpty(title, pages);
    return isDirty && !isEmpty;
  }

  // 重新整理或關閉分頁前示警。只擋瀏覽器層級的離開，App 內路由切換交給下面的
  // workspace leave guard 處理。
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedEpisodeChanges()) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase, title, summary, status, selectedVolumeId, pages]);

  // embedded 模式下才需要讓工作台知道「離開前要不要確認」——非 embedded 的獨立頁面
  // 沒有工作台側邊欄／回列表按鈕可以攔。這裡不能像 Story/LoreEditor 一樣只註冊
  // 一次：hasUnsavedEpisodeChanges 讀的 phase／title／pages 都是一般 state 不是
  // ref，閉包會固定在註冊當下那次 render，所以要隨這些值變動重新註冊一次。
  useEffect(() => {
    if (!embedded) {
      return;
    }
    return registerWorkspaceLeaveGuard(hasUnsavedEpisodeChanges);
  }, [embedded, phase, title, summary, status, selectedVolumeId, pages]);

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
      <StorytellerShell
        title={pageTitle}
        breadcrumbs={embedded ? [] : shellBreadcrumbs}
      >
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell
        title={pageTitle}
        breadcrumbs={embedded ? [] : shellBreadcrumbs}
      >
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
      <StorytellerShell
        title={pageTitle}
        breadcrumbs={embedded ? [] : shellBreadcrumbs}
      >
        <StorytellerLoading label="正在載入專案資料..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={
          embedded
            ? steamloomPath(
                defaultVolumeIdFromQuery
                  ? `my/workspace/${id}/stories/${defaultVolumeIdFromQuery}`
                  : `my/workspace/${id}`,
              )
            : undefined
        }
      />
    );
  }

  if (!isNewEpisode && !initialized) {
    if (
      isStoriesLoading ||
      isPagesLoading ||
      (existingStory?.parent_id !== null && isVolumesLoading)
    ) {
      return (
        <StorytellerShell
          title={pageTitle}
          breadcrumbs={embedded ? [] : shellBreadcrumbs}
        >
          <StorytellerLoading label="正在載入話的資料..." />
        </StorytellerShell>
      );
    }
    if (!existingStory || existingStory.content_type !== "image") {
      return (
        <ErrorPage
          code={404}
          compact={embedded}
          backUrl={
            embedded
              ? steamloomPath(
                  defaultVolumeIdFromQuery
                    ? `my/workspace/${id}/stories/${defaultVolumeIdFromQuery}`
                    : `my/workspace/${id}`,
                )
              : undefined
          }
        />
      );
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

  function addAssetPage(asset: StorytellerAsset) {
    if (pages.length >= STORYTELLER_IMAGE_PAGE_MAX_COUNT) {
      setFileWarning(`一話最多 ${STORYTELLER_IMAGE_PAGE_MAX_COUNT} 頁`);
      setAssetPickerOpen(false);
      return;
    }
    setPages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        previewUrl: asset.preview_url,
        description: "",
        assetPublicId: asset.public_id,
      },
    ]);
    setFileWarning(null);
    setAssetPickerOpen(false);
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
      // 只上傳還沒建立資產的本機頁面——重試時已經拿到 asset_public_id/key 的頁面不用重來。
      const pendingIndexes = pages
        .map((page, index) =>
          page.assetPublicId || page.uploadedKey ? null : index,
        )
        .filter((index): index is number => index !== null);

      // resolvedAssetIds/resolvedKeys 是函式內的本地變數，不能靠讀 pages state 組最後的 content——
      // 同一次函式執行內看不到自己剛 setPages 寫回去的結果，會讀到舊的快照。
      const resolvedAssetIds = pages.map((page) => page.assetPublicId);
      const resolvedKeys = pages.map((page) => page.uploadedKey);

      if (pendingIndexes.length > 0) {
        const uploadedAssets = await uploadAssets.mutateAsync({
          files: pendingIndexes.map((pageIndex) => pages[pageIndex].file!),
          onProgress: (uploadIndex, loaded, total) => {
            const page = pages[pendingIndexes[uploadIndex]];
            setProgress((current) => ({
              ...current,
              [page.id]: { loaded, total },
            }));
          },
        });
        uploadedAssets.forEach((asset, uploadIndex) => {
          const pageIndex = pendingIndexes[uploadIndex];
          resolvedAssetIds[pageIndex] = asset.public_id;
          setPages((current) =>
            current.map((item, index) =>
              index === pageIndex
                ? { ...item, assetPublicId: asset.public_id }
                : item,
            ),
          );
        });
        if (uploadedAssets.length !== pendingIndexes.length) {
          throw new Error("部分圖片沒有完成資產建立，請重試。");
        }
      }

      const content = JSON.stringify({
        pages: pages.map((page, index) => ({
          id: page.id,
          key: resolvedKeys[index] || undefined,
          asset_public_id: resolvedAssetIds[index] || undefined,
          description: page.description,
          sort: index,
        })),
      });

      const savedStory = await saveStory.mutateAsync({
        storyPublicId: existingStory?.public_id,
        input: {
          title: title.trim(),
          summary: summary.trim(),
          status,
          sort: existingStory?.sort ?? 0,
          content,
          content_type: "image",
          parent_id: selectedVolumeId,
        },
      });

      setPhase("idle");
      // 存檔成功後要把「離開頁面示警」的基準往前推，不然嵌入模式下沒有整頁跳轉的
      // 既有話存完檔，畫面還在同一頁，卻繼續被判定成「有未存檔變更」。跟上面組
      // content 用的邏輯一樣，直接用 resolvedAssetIds/resolvedKeys 這兩個本地變數，
      // 不能等 pages state 事後才追上來。
      lastSavedDraftRef.current = serializeEpisodeDraft(
        title,
        summary,
        status,
        selectedVolumeId,
        pages.map((page, index) => ({
          ...page,
          assetPublicId: resolvedAssetIds[index] || page.assetPublicId,
          uploadedKey: resolvedKeys[index] || page.uploadedKey,
        })),
      );
      if (!embedded) {
        navigate(steamloomPath(`my/project/${project.public_id}/images`));
      } else if (isNewEpisode && savedStory?.public_id) {
        // embedded（工作台）模式下，新建話存檔成功後要把網址從 .../image/new
        // 換成真正的 public_id，不然 isNewEpisode 永遠是 true，下一次存檔又會
        // 走建立流程、變成建出重複的話。
        navigate(
          steamloomPath(
            `my/workspace/${project.public_id}/image/${savedStory.public_id}`,
          ),
        );
      }
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
    if (page.assetPublicId || page.uploadedKey) {
      return sum + (page.file?.size ?? 0);
    }
    const pageProgress = progress[page.id];
    return sum + (pageProgress?.loaded ?? 0);
  }, 0);
  const overallPercent =
    totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const isSubmitting = phase === "uploading";
  const statusOptions = [
    {
      value: "draft",
      label: "未公開",
      icon: <VisibilityOffIcon fontSize="small" />,
    },
    {
      value: "completed",
      label: "公開中",
      icon: <VisibilityIcon fontSize="small" />,
    },
  ];
  const volumeOptions = [
    { value: "", label: "不分冊", icon: <FolderIcon fontSize="small" /> },
    ...apiVolumes.map((volume) => ({
      value: volume.public_id,
      label: volume.title,
      icon: <FolderIcon fontSize="small" />,
    })),
  ];
  // 存檔按鈕只在 embedded 模式下顯示，且要跟標題排在同一列（見下面
  // WorkspaceEditorHeaderRow），非 embedded 模式沒有對應的 action 內容。
  const imageEditorActionContent = embedded ? (
    <Button
      size="small"
      variant="contained"
      startIcon={<CollectionsIcon />}
      disabled={!title.trim() || pages.length === 0 || isSubmitting}
      onClick={() => void handleSubmit()}
    >
      {isSubmitting ? "處理中..." : phase === "error" ? "重試" : "儲存"}
    </Button>
  ) : undefined;
  const embeddedHeaderContent = embedded ? (
    <Stack spacing={2.25}>
      <WorkspaceEditorHeaderRow
        title={
          <WorkspaceEditableTitle
            value={title}
            disabled={isSubmitting}
            placeholder="未命名圖像作品"
            onChange={setTitle}
          />
        }
        actions={imageEditorActionContent}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <WorkspaceEditorSelectButton
          icon={
            status === "completed" ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )
          }
          label="狀態"
          value={status}
          options={statusOptions}
          disabled={isSubmitting}
          onChange={(value) => setStatus(value as "draft" | "completed")}
        />
        <WorkspaceEditorSelectButton
          icon={<FolderIcon fontSize="small" />}
          label="冊"
          value={selectedVolumeId}
          options={volumeOptions}
          disabled={isSubmitting}
          onChange={setSelectedVolumeId}
        />
      </Stack>
      <WorkspaceEditableSummary
        value={summary}
        disabled={isSubmitting}
        placeholder="新增描述..."
        onChange={setSummary}
      />
    </Stack>
  ) : undefined;

  return (
    <StorytellerShell
      title={pageTitle}
      breadcrumbs={embedded ? [] : shellBreadcrumbs}
      hideHeading={embedded}
      plain={embedded}
      headerContent={embeddedHeaderContent}
    >
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
        <Paper
          variant={embedded ? "elevation" : "outlined"}
          elevation={0}
          sx={{
            p: embedded ? 0 : { xs: 2, md: 3 },
            borderRadius: 1,
            bgcolor: "transparent",
          }}
        >
          <Stack spacing={3}>
            {!embedded && (
              <>
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
                <TextField
                  fullWidth
                  select
                  label="冊"
                  value={selectedVolumeId}
                  disabled={isSubmitting}
                  onChange={(event) => setSelectedVolumeId(event.target.value)}
                  helperText="未選擇時視為不分冊。"
                >
                  <MenuItem value="">不分冊</MenuItem>
                  {apiVolumes.map((volume) => (
                    <MenuItem key={volume.public_id} value={volume.public_id}>
                      {volume.title}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
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
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<CollectionsIcon />}
                  disabled={isSubmitting}
                  onClick={() => setAssetPickerOpen(true)}
                >
                  從資產集加入
                </Button>
              </Stack>
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
                    const percent =
                      page.assetPublicId || page.uploadedKey
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
            {!embedded && (
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
            )}
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
      <StorytellerAssetPickerDialog
        open={assetPickerOpen}
        projectPublicId={project.public_id}
        title="從資產集加入頁面"
        onClose={() => setAssetPickerOpen(false)}
        onSelect={addAssetPage}
      />
    </StorytellerShell>
  );
}
