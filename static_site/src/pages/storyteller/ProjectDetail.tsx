import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import LinkIcon from "@mui/icons-material/Link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useDeleteStorytellerStory,
  useSaveStorytellerVolume,
  useStorytellerImageStoryPages,
  useStorytellerProjects,
  usePatchStorytellerStory,
  useStorytellerStories,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { SteamRegistrationMarks } from "@/components/storyteller/SteamPanelAccent.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import {
  steamPanelTopBarSx,
  steamTabIndicatorSx,
} from "@/data/storytellerTheme.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import { StorytellerAssetManager } from "@/pages/storyteller/StorytellerAssetManager.tsx";
import { StorytellerLoreManager } from "@/pages/storyteller/StorytellerLoreManager.tsx";
import { StorytellerVolumeDialog } from "@/pages/storyteller/StorytellerVolumeDialog.tsx";
import { sortedGroup } from "@/pages/storyteller/storytellerVolumes.ts";
import type { StorytellerStory } from "@/types/storyteller.ts";

// 穩定的空陣列參考：查詢尚未回傳資料時（例如登入狀態剛載入、query 被停用）
// 用同一個參考當預設值，避免每次 render 都產生新陣列，觸發下方 useEffect 無限重渲染
const emptyStories: StorytellerStory[] = [];
const emptyVolumes: StorytellerStory[] = [];
const storyPageSize = 20;
const ungroupedStoryCollectionId = "__ungrouped__";

function dropTargetSx(active: boolean): SxProps<Theme> {
  return {
    borderRadius: 1,
    outline: active ? "2px solid" : "1px dashed transparent",
    outlineColor: active ? "primary.main" : "transparent",
    outlineOffset: 2,
    bgcolor: active ? "action.selected" : "transparent",
    transition: "background-color 120ms ease, outline-color 120ms ease",
    "&:hover": {
      outlineColor: "primary.main",
      bgcolor: "action.hover",
    },
  };
}

// StoryRow 是「作品與冊」統一列表裡的單一列，文字故事跟話（content_type=image）
// 共用同一列樣式，只有圖示／字數或頁數／編輯連結不同。話的頁數需要另外呼叫
// useStorytellerImageStoryPages 才知道，文字故事則不需要（gate 掉，不會多打 API）。
function StoryRow({
  story,
  projectId,
  draggingStoryId,
  saving,
  onDragStart,
  onDragOverAllowVolumeOnly,
  onDrop,
  onTogglePublish,
  onOpenMoveMenu,
  onDelete,
}: {
  story: StorytellerStory;
  projectId: string;
  draggingStoryId: string | null;
  saving: boolean;
  onDragStart: () => void;
  onDragOverAllowVolumeOnly: boolean;
  onDrop: () => void;
  onTogglePublish: (checked: boolean) => void;
  onOpenMoveMenu: (anchorEl: HTMLElement) => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isImage = story.content_type === "image";
  const { data: pages = [] } = useStorytellerImageStoryPages(
    isImage ? projectId : undefined,
    isImage ? story.public_id : undefined,
  );
  return (
    <Tooltip title={t("web.projectWorkspace.story.dragHint")}>
      <Paper
        draggable
        variant="outlined"
        onDragStart={onDragStart}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // 正在拖曳的是「冊」而不是故事時，不要在這裡吃掉事件——讓它冒泡到
          // 外層冊卡片的 onDrop，才能把冊排到「目前排最前面的那個冊」前面。
          if (onDragOverAllowVolumeOnly) {
            return;
          }
          event.stopPropagation();
          onDrop();
        }}
        sx={{
          p: 2,
          borderRadius: 1,
          cursor: "grab",
          opacity: draggingStoryId === story.public_id ? 0.55 : 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isImage ? (
            <CollectionsIcon color="primary" />
          ) : (
            <ArticleIcon color="primary" />
          )}
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={800}>{story.title}</Typography>
            {story.summary.trim() && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {story.summary}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {isImage
                ? t("web.projectWorkspace.meta.pages", { count: pages.length })
                : t("web.projectWorkspace.meta.words", {
                    count: story.word_count.toLocaleString(i18n.resolvedLanguage),
                  })}{" "}
              · {formatStorytellerDate(story.updated_at, i18n.resolvedLanguage)}
            </Typography>
          </Stack>
          <Tooltip
            title={
              story.status === "completed"
                ? t("web.projectWorkspace.story.unpublishHint")
                : t("web.projectWorkspace.story.publishHint")
            }
          >
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  size="small"
                  color="success"
                  checked={story.status === "completed"}
                  disabled={saving}
                  onChange={(event) => onTogglePublish(event.target.checked)}
                />
              }
              label={
                story.status === "completed"
                  ? t("web.projectWorkspace.status.published")
                  : t("web.projectWorkspace.status.unpublished")
              }
            />
          </Tooltip>
          <Tooltip title={t("web.projectWorkspace.story.move")}>
            <IconButton
              size="small"
              onClick={(event) => onOpenMoveMenu(event.currentTarget)}
              aria-label={t("web.projectWorkspace.story.move")}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("web.projectWorkspace.story.edit")}>
            <IconButton
              component="a"
              href={steamloomPath(
                `my/project/${projectId}/${isImage ? "image" : "story"}/${story.public_id}`,
              )}
              size="small"
              color="primary"
              aria-label={t("web.projectWorkspace.story.edit")}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("web.projectWorkspace.story.delete")}>
            <IconButton
              color="error"
              size="small"
              onClick={onDelete}
              aria-label={t("web.projectWorkspace.story.delete")}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Tooltip>
  );
}

export default function StorytellerProjectDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, login, submitting } = useAuth();
  // 故事與話（圖像作品）已經合併成同一份列表，不再分開分頁；舊的 /images 網址
  // 沿用同一顆 "stories" tab，維持舊書籤／連結可以打開。
  const activeTab: "stories" | "lores" | "assets" = location.pathname.endsWith(
    "/lores",
  )
    ? "lores"
    : location.pathname.endsWith("/assets")
      ? "assets"
      : "stories";
  const [orderedStories, setOrderedStories] = useState<StorytellerStory[]>([]);
  const [orderedVolumes, setOrderedVolumes] = useState<StorytellerStory[]>([]);
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const [draggingVolumeId, setDraggingVolumeId] = useState<string | null>(null);
  const [activeStoryCollectionId, setActiveStoryCollectionId] = useState("");
  const [storiesPage, setStoriesPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<StorytellerStory | null>(
    null,
  );
  // volumeDialogTarget："new" 代表新增冊，StorytellerStory 代表重新命名該冊。
  const [volumeDialogTarget, setVolumeDialogTarget] = useState<
    "new" | StorytellerStory | null
  >(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] =
    useState<StorytellerStory | null>(null);
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [storyMoveMenu, setStoryMoveMenu] = useState<{
    anchorEl: HTMLElement;
    story: StorytellerStory;
  } | null>(null);
  const createButtonGroupRef = useRef<HTMLDivElement | null>(null);
  const [copyMessageOpen, setCopyMessageOpen] = useState(false);
  const [copyErrorOpen, setCopyErrorOpen] = useState(false);
  const [reorderError, setReorderError] = useState("");
  const [actionSnack, setActionSnack] = useState<{
    message: string;
    severity: "success" | "error";
  }>({ message: "", severity: "success" });
  function notifyAction(
    message: string,
    severity: "success" | "error" = "success",
  ) {
    setActionSnack({ message, severity });
  }
  const {
    data: apiProjects = [],
    isPending: apiProjectsPending,
    isFetching: apiProjectsFetching,
  } = useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        slug: apiProject.slug,
        description: apiProject.description,
        visibility: apiProject.visibility,
        rating: apiProject.rating,
        tags: apiProject.tags ?? [],
        shareToken: apiProject.share_token,
        statusLabel:
          apiProject.visibility === "public"
            ? t("web.projectWorkspace.visibility.public")
            : apiProject.visibility === "unlisted"
              ? t("web.projectWorkspace.visibility.unlisted")
              : t("web.projectWorkspace.visibility.private"),
        storiesCount: (apiProject.stories ?? []).filter(
          (story) => story.content_type !== "image",
        ).length,
        updatedAt: apiProject.updated_at,
      }
    : undefined;
  const { data: apiStories = emptyStories, isLoading: apiStoriesLoading } =
    useStorytellerStories(apiProject?.public_id);
  const { data: apiVolumes = emptyVolumes, isLoading: apiVolumesLoading } =
    useStorytellerVolumes(apiProject?.public_id);
  // imageStoryCount 只用來給上方 meta chip 顯示「幾話」，作品與冊本身的列表
  // 已經不分文字／圖像，兩種都在 orderedStories／orderedVolumes 裡混著顯示。
  const imageStoryCount = apiStories.filter(
    (story) => story.content_type === "image",
  ).length;
  const activeStoryVolume = orderedVolumes.find(
    (volume) => volume.public_id === activeStoryCollectionId,
  );
  const activeStoryParentId =
    activeStoryCollectionId === ungroupedStoryCollectionId
      ? null
      : activeStoryVolume?.id;
  const visibleStories =
    activeStoryCollectionId === ""
      ? orderedStories
      : activeStoryCollectionId === ungroupedStoryCollectionId
        ? sortedGroup(orderedStories, null)
        : activeStoryVolume
          ? sortedGroup(orderedStories, activeStoryVolume.id)
          : [];
  const storiesTotalPages = Math.ceil(visibleStories.length / storyPageSize);
  const pagedStories = visibleStories.slice(
    (storiesPage - 1) * storyPageSize,
    storiesPage * storyPageSize,
  );
  // 排序、移動到冊、狀態切換只送變動欄位（PATCH），後端不寫版本、不會拿舊內文蓋掉新內容
  const patchStory = usePatchStorytellerStory(apiProject?.public_id);
  const saveVolume = useSaveStorytellerVolume(apiProject?.public_id);
  const deleteStory = useDeleteStorytellerStory(apiProject?.public_id);
  const deleteProject = useDeleteStorytellerProject();

  useEffect(() => {
    setOrderedStories([...apiStories]);
  }, [apiStories]);

  useEffect(() => {
    setOrderedVolumes(
      [...apiVolumes].sort((left, right) => left.sort - right.sort),
    );
  }, [apiVolumes]);

  useEffect(() => {
    setStoriesPage(1);
  }, [activeStoryCollectionId]);

  useEffect(() => {
    if (storiesTotalPages > 0 && storiesPage > storiesTotalPages) {
      setStoriesPage(storiesTotalPages);
    }
  }, [storiesPage, storiesTotalPages]);

  useEffect(() => {
    if (
      activeStoryCollectionId &&
      activeStoryCollectionId !== ungroupedStoryCollectionId &&
      !orderedVolumes.some(
        (volume) => volume.public_id === activeStoryCollectionId,
      )
    ) {
      setActiveStoryCollectionId("");
    }
  }, [activeStoryCollectionId, orderedVolumes]);

  // handleDropVolume 把拖曳中的冊放到 targetVolumeId 前面（null 代表放到最後），
  // 只重排冊彼此之間的順序，跟故事的 parent_id 無關。
  function handleDropVolume(targetVolumeId: string | null) {
    if (!draggingVolumeId || draggingVolumeId === targetVolumeId) {
      setDraggingVolumeId(null);
      return;
    }
    const draggingIndex = orderedVolumes.findIndex(
      (item) => item.public_id === draggingVolumeId,
    );
    if (draggingIndex < 0) {
      setDraggingVolumeId(null);
      return;
    }
    const nextVolumes = [...orderedVolumes];
    const [draggingVolume] = nextVolumes.splice(draggingIndex, 1);
    const dropIndex = targetVolumeId
      ? nextVolumes.findIndex((item) => item.public_id === targetVolumeId)
      : nextVolumes.length;
    nextVolumes.splice(
      dropIndex < 0 ? nextVolumes.length : dropIndex,
      0,
      draggingVolume,
    );
    setOrderedVolumes(nextVolumes);
    setDraggingVolumeId(null);
    nextVolumes.forEach((item, index) => {
      if (item.sort === index) {
        return;
      }
      // 同一次拖曳會送多筆更新；每筆 Promise 都要接錯誤，不能只靠最後一次 mutate 回呼。
      void patchStory
        .mutateAsync({ storyPublicId: item.public_id, input: { sort: index } })
        .catch(() =>
          setReorderError(t("web.projectWorkspace.errors.volumeReorder")),
        );
    });
  }

  // handleDropStory 把拖曳中的故事放到目標分組（targetVolumeId=null 代表未分冊）的
  // targetStoryId 前面（null 代表放到該分組最後）。只有真的換組的那篇故事會在存檔時
  // 帶上 parent_id；純粹重新排序的故事只送 sort，parent_id 留空代表不更動冊隸屬。
  function handleDropStory(
    targetVolumeId: number | null,
    targetStoryId: string | null,
  ) {
    if (!draggingStoryId || draggingStoryId === targetStoryId) {
      setDraggingStoryId(null);
      return;
    }
    const draggingStory = orderedStories.find(
      (item) => item.public_id === draggingStoryId,
    );
    if (!draggingStory) {
      setDraggingStoryId(null);
      return;
    }
    // 冊是通用容器，文字故事跟話可以混著放在同一冊裡，不用檢查類型是否相符。
    const sourceVolumeId = draggingStory.parent_id;
    const remaining = orderedStories.filter(
      (item) => item.public_id !== draggingStoryId,
    );
    const targetGroup = sortedGroup(remaining, targetVolumeId);
    const insertIndex = targetStoryId
      ? targetGroup.findIndex((item) => item.public_id === targetStoryId)
      : targetGroup.length;
    targetGroup.splice(
      insertIndex < 0 ? targetGroup.length : insertIndex,
      0,
      draggingStory,
    );

    const changed = new Map<
      string,
      { sort: number; parentId?: number | null }
    >();
    targetGroup.forEach((item, index) => {
      const movedHere = item.public_id === draggingStoryId;
      if (item.sort !== index || movedHere) {
        changed.set(item.public_id, {
          sort: index,
          parentId: movedHere ? targetVolumeId : undefined,
        });
      }
    });
    if (sourceVolumeId !== targetVolumeId) {
      sortedGroup(remaining, sourceVolumeId).forEach((item, index) => {
        if (item.sort !== index) {
          changed.set(item.public_id, { sort: index });
        }
      });
    }

    setOrderedStories((previous) =>
      previous.map((item) => {
        const update = changed.get(item.public_id);
        if (!update) {
          return item;
        }
        return {
          ...item,
          sort: update.sort,
          parent_id:
            update.parentId !== undefined ? update.parentId : item.parent_id,
        };
      }),
    );
    setDraggingStoryId(null);

    changed.forEach((update, storyPublicId) => {
      const item = orderedStories.find((s) => s.public_id === storyPublicId);
      if (!item) {
        return;
      }
      const targetVolume =
        update.parentId !== undefined && update.parentId !== null
          ? apiVolumes.find((volume) => volume.id === update.parentId)
          : undefined;
      void patchStory
        .mutateAsync({
          storyPublicId,
          input: {
            sort: update.sort,
            ...(update.parentId !== undefined
              ? { parent_id: targetVolume?.public_id ?? "" }
              : {}),
          },
        })
        .catch(() =>
          setReorderError(t("web.projectWorkspace.errors.storyReorder")),
        );
    });
  }

  function storyCountForVolume(volumeID: number | null) {
    return sortedGroup(orderedStories, volumeID).length;
  }

  function canDropDraggingStory(parentID: number | null) {
    const draggingStory = orderedStories.find(
      (story) => story.public_id === draggingStoryId,
    );
    return Boolean(draggingStory && draggingStory.parent_id !== parentID);
  }

  function handleUngroupedDragOver(event: DragEvent<HTMLElement>) {
    if (!canDropDraggingStory(null)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleUngroupedDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (draggingStoryId) {
      handleDropStory(null, null);
    }
  }

  function handleVolumeCollectionDragOver(
    event: DragEvent<HTMLElement>,
    volume: StorytellerStory,
  ) {
    if (
      (draggingVolumeId && draggingVolumeId !== volume.public_id) ||
      canDropDraggingStory(volume.id)
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleVolumeCollectionDrop(
    event: DragEvent<HTMLElement>,
    volume: StorytellerStory,
  ) {
    event.preventDefault();
    if (draggingVolumeId) {
      handleDropVolume(volume.public_id);
      return;
    }
    if (draggingStoryId) {
      handleDropStory(volume.id, null);
    }
  }

  function toggleVolumeStatus(volume: StorytellerStory) {
    const completed = volume.status !== "completed";
    patchStory.mutate(
      {
        storyPublicId: volume.public_id,
        input: { status: completed ? "completed" : "draft" },
      },
      {
        onSuccess: () =>
          notifyAction(
            completed
              ? t("web.projectWorkspace.messages.volumePublished")
              : t("web.projectWorkspace.messages.volumeUnpublished"),
          ),
        onError: () =>
          notifyAction(t("web.projectWorkspace.errors.volumeStatus"), "error"),
      },
    );
  }

  function moveStoryToVolume(story: StorytellerStory, volumePublicId: string) {
    const targetVolume = volumePublicId
      ? orderedVolumes.find((volume) => volume.public_id === volumePublicId)
      : undefined;
    if (volumePublicId && !targetVolume) {
      setStoryMoveMenu(null);
      return;
    }
    const nextParentID = targetVolume?.id ?? null;
    if (story.parent_id === nextParentID) {
      setStoryMoveMenu(null);
      return;
    }
    const nextSort = storyCountForVolume(nextParentID);
    setOrderedStories((previous) =>
      previous.map((item) =>
        item.public_id === story.public_id
          ? { ...item, parent_id: nextParentID, sort: nextSort }
          : item,
      ),
    );
    setStoryMoveMenu(null);
    patchStory.mutate(
      {
        storyPublicId: story.public_id,
        input: { sort: nextSort, parent_id: volumePublicId },
      },
      {
        onSuccess: () =>
          notifyAction(t("web.projectWorkspace.messages.storyMoved")),
        onError: () => {
          // 移動是樂觀更新，存檔失敗時要還原清單，避免畫面假裝移動成功。
          setOrderedStories((current) =>
            current.map((item) =>
              item.public_id === story.public_id ? story : item,
            ),
          );
          notifyAction(t("web.projectWorkspace.errors.storyMove"), "error");
        },
      },
    );
  }

  useTitle(
    project
      ? `${project.name} - ${STORYTELLER_APP_NAME}`
      : t("web.projectWorkspace.pageTitle", { appName: STORYTELLER_APP_NAME }),
    {
      path: id
        ? steamloomPath(`my/project/${id}/${activeTab}`)
        : steamloomPath("my/projects"),
      robots: "noindex, nofollow",
    },
  );

  const projectShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: t("web.home.workspace"), to: steamloomPath("my") },
    {
      label: t("web.projectWorkspace.projects"),
      to: steamloomPath("my/projects"),
    },
  ];

  if (loading) {
    return (
      <StorytellerShell
        title={t("web.projectWorkspace.projects")}
        breadcrumbs={projectShellBreadcrumbs}
      >
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">
            {t("web.home.checkingLogin")}
          </Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell
        title={t("web.projectWorkspace.projects")}
        breadcrumbs={projectShellBreadcrumbs}
      >
        <CustomLoginRequiredState
          description={t("web.projectWorkspace.loginDescription")}
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (!project && (apiProjectsPending || apiProjectsFetching)) {
    return (
      <StorytellerShell
        title={t("web.projectWorkspace.projects")}
        breadcrumbs={projectShellBreadcrumbs}
      >
        <StorytellerLoading label={t("web.projectWorkspace.loadingProject")} />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }
  const projectId = project.id;

  // renderDropEndZone 補一塊有實際高度的拖放目標，放在每份清單最後一項的後面。
  // 沒有這塊的話，清單的容器範圍會直接貼齊最後一項卡片的下緣，容器本身的
  // onDrop（放到最後）永遠踩不到，使用者只能拖到「插在某一項之前」，
  // 想排到最後得先繞道排到倒數第二再把原本最後一項往前搬。
  function renderDropEndZone(onDrop: () => void) {
    return (
      <Box
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // 這塊常常嵌在自己也有 onDrop 的容器裡（冊卡片、未分冊作品清單），
          // 不擋掉冒泡的話同一次放開滑鼠會把 handleDropStory／handleDropVolume
          // 疊加執行兩次。
          event.stopPropagation();
          onDrop();
        }}
        sx={{ minHeight: 16 }}
      />
    );
  }

  function renderStoryRow(story: StorytellerStory) {
    return (
      <StoryRow
        key={story.public_id}
        story={story}
        projectId={projectId}
        draggingStoryId={draggingStoryId}
        saving={patchStory.isPending}
        onDragOverAllowVolumeOnly={Boolean(draggingVolumeId)}
        onDragStart={() => {
          setDraggingVolumeId(null);
          setDraggingStoryId(story.public_id);
        }}
        onDrop={() => handleDropStory(story.parent_id, story.public_id)}
        onTogglePublish={(checked) =>
          patchStory.mutate(
            {
              storyPublicId: story.public_id,
              input: { status: checked ? "completed" : "draft" },
            },
            {
              onSuccess: () =>
                notifyAction(
                  checked
                    ? t("web.projectWorkspace.messages.storyPublished")
                    : t("web.projectWorkspace.messages.storyUnpublished"),
                ),
              onError: () =>
                notifyAction(
                  t("web.projectWorkspace.errors.storyStatus"),
                  "error",
                ),
            },
          )
        }
        onOpenMoveMenu={(anchorEl) => setStoryMoveMenu({ anchorEl, story })}
        onDelete={() => setDeleteTarget(story)}
      />
    );
  }

  const readerUrl =
    project.visibility === "unlisted" && project.shareToken
      ? steamloomPath(`work/share/${project.shareToken}`)
      : storytellerReaderPath({
          public_id: project.id,
          slug: project.slug,
        });
  const readerUrlLabel =
    project.visibility === "unlisted"
      ? t("web.projectWorkspace.shareLink")
      : t("web.projectWorkspace.readerLink");
  const absoluteReaderUrl =
    typeof window === "undefined"
      ? readerUrl
      : new URL(readerUrl, window.location.origin).toString();

  async function copyReaderUrl() {
    try {
      await navigator.clipboard.writeText(absoluteReaderUrl);
      setCopyMessageOpen(true);
    } catch {
      setCopyErrorOpen(true);
    } finally {
      setLinkMenuAnchor(null);
    }
  }

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: t("web.home.workspace"), to: steamloomPath("my") },
        {
          label: t("web.projectWorkspace.projects"),
          to: steamloomPath("my/projects"),
        },
        {
          label: project.name,
          to: steamloomPath(`my/project/${project.id}`),
        },
        {
          label:
            activeTab === "lores"
              ? t("web.projectWorkspace.tabs.lores")
              : activeTab === "assets"
                ? t("web.projectWorkspace.tabs.assets")
                : t("web.projectWorkspace.tabs.stories"),
        },
      ]}
    >
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 1, ...steamPanelTopBarSx }}
        >
          <SteamRegistrationMarks inset={7} />
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={(event) => setLinkMenuAnchor(event.currentTarget)}
              >
                {readerUrlLabel}
              </Button>
              <Menu
                anchorEl={linkMenuAnchor}
                open={Boolean(linkMenuAnchor)}
                onClose={() => setLinkMenuAnchor(null)}
              >
                <MenuItem onClick={() => void copyReaderUrl()}>
                  {t("web.projectWorkspace.copyLink")}
                </MenuItem>
                <MenuItem
                  component="a"
                  href={readerUrl}
                  onClick={() => setLinkMenuAnchor(null)}
                >
                  {t("web.projectWorkspace.openLink")}
                </MenuItem>
              </Menu>
              <Chip label={project.statusLabel} color="primary" />
              <Chip
                icon={<ArticleIcon />}
                variant="outlined"
                label={t("web.projectWorkspace.meta.stories", {
                  count:
                    orderedStories.filter(
                      (story) => story.content_type !== "image",
                    ).length || project.storiesCount,
                })}
              />
              {imageStoryCount > 0 && (
                <Chip
                  icon={<CollectionsIcon />}
                  variant="outlined"
                  label={t("web.projectWorkspace.meta.episodes", {
                    count: imageStoryCount,
                  })}
                />
              )}
              <Chip
                label={storytellerProjectRatingLabel(project.rating)}
                color={storytellerProjectRatingColor(project.rating)}
                variant="outlined"
              />
              <Chip
                label={t("web.projectWorkspace.meta.updated", {
                  date: formatStorytellerDate(
                    project.updatedAt,
                    i18n.resolvedLanguage,
                  ),
                })}
              />
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
            >
              <ButtonGroup size="small" variant="outlined">
                <Tooltip title={t("web.projectWorkspace.editProject")}>
                  <Button
                    href={steamloomPath(`my/project/${project.id}/edit`)}
                    aria-label={t("web.projectWorkspace.editProject")}
                  >
                    <EditIcon fontSize="small" />
                  </Button>
                </Tooltip>
                <Tooltip title={t("web.projectWorkspace.deleteProject")}>
                  <Button
                    color="error"
                    onClick={() => setProjectDeleteOpen(true)}
                    aria-label={t("web.projectWorkspace.deleteProject")}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </Stack>
          </Stack>
          <StorytellerTagChips tags={project.tags} sx={{ mt: 1.5 }} />
        </Paper>
        <CustomSnackbar
          open={copyMessageOpen}
          message={t("web.projectWorkspace.messages.linkCopied")}
          onClose={() => setCopyMessageOpen(false)}
        />
        <CustomSnackbar
          open={copyErrorOpen}
          message={t("web.projectWorkspace.errors.copyLink")}
          severity="error"
          onClose={() => setCopyErrorOpen(false)}
        />
        <CustomSnackbar
          open={Boolean(reorderError)}
          message={reorderError}
          severity="error"
          onClose={() => setReorderError("")}
        />
        <CustomSnackbar
          open={Boolean(actionSnack.message)}
          message={actionSnack.message}
          severity={actionSnack.severity}
          onClose={() => setActionSnack((prev) => ({ ...prev, message: "" }))}
        />

        <Grid container spacing={2}>
          <Grid size={12}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={2}>
                <Tabs
                  value={activeTab}
                  onChange={(_, value: "stories" | "lores" | "assets") =>
                    navigate(steamloomPath(`my/project/${project.id}/${value}`))
                  }
                  sx={steamTabIndicatorSx}
                >
                  <Tab
                    value="stories"
                    label={t("web.projectWorkspace.tabs.stories")}
                  />
                  <Tab
                    value="lores"
                    label={t("web.projectWorkspace.tabs.lores")}
                  />
                  <Tab
                    value="assets"
                    label={t("web.projectWorkspace.tabs.assets")}
                  />
                </Tabs>
                {activeTab === "stories" && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Typography variant="h6" fontWeight={800}>
                      {t("web.projectWorkspace.tabs.stories")}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        variant="outlined"
                        startIcon={<CreateNewFolderIcon />}
                        onClick={() => setVolumeDialogTarget("new")}
                        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                      >
                        {t("web.projectWorkspace.volume.add")}
                      </Button>
                      <ButtonGroup
                        ref={createButtonGroupRef}
                        variant="contained"
                        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                      >
                        <Button
                          onClick={() =>
                            setCreateMenuAnchor(createButtonGroupRef.current)
                          }
                          sx={{ flex: { xs: 1, sm: "initial" } }}
                        >
                          {t("web.common.create")}
                        </Button>
                        <Button
                          size="small"
                          onClick={() =>
                            setCreateMenuAnchor(createButtonGroupRef.current)
                          }
                          sx={{ px: 0.5 }}
                        >
                          <ArrowDropDownIcon />
                        </Button>
                      </ButtonGroup>
                      <Menu
                        anchorEl={createMenuAnchor}
                        open={Boolean(createMenuAnchor)}
                        onClose={() => setCreateMenuAnchor(null)}
                      >
                        <MenuItem
                          component="a"
                          href={steamloomPath(
                            `my/project/${project.id}/story/new`,
                          )}
                          onClick={() => setCreateMenuAnchor(null)}
                        >
                          <ListItemIcon>
                            <ArticleIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>
                            {t("web.projectWorkspace.story.text")}
                          </ListItemText>
                        </MenuItem>
                        <MenuItem
                          component="a"
                          href={steamloomPath(
                            `my/project/${project.id}/image/new`,
                          )}
                          onClick={() => setCreateMenuAnchor(null)}
                        >
                          <ListItemIcon>
                            <CollectionsIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>
                            {t("web.projectWorkspace.story.image")}
                          </ListItemText>
                        </MenuItem>
                      </Menu>
                      <Menu
                        anchorEl={storyMoveMenu?.anchorEl ?? null}
                        open={Boolean(storyMoveMenu)}
                        onClose={() => setStoryMoveMenu(null)}
                      >
                        <MenuItem
                          disabled={
                            patchStory.isPending ||
                            storyMoveMenu?.story.parent_id === null
                          }
                          onClick={() =>
                            storyMoveMenu &&
                            moveStoryToVolume(storyMoveMenu.story, "")
                          }
                        >
                          <ListItemIcon>
                            <FolderIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>
                            {t("web.projectWorkspace.story.moveUngrouped")}
                          </ListItemText>
                        </MenuItem>
                        {orderedVolumes.map((volume) => (
                          <MenuItem
                            key={volume.public_id}
                            disabled={
                              patchStory.isPending ||
                              storyMoveMenu?.story.parent_id === volume.id
                            }
                            onClick={() =>
                              storyMoveMenu &&
                              moveStoryToVolume(
                                storyMoveMenu.story,
                                volume.public_id,
                              )
                            }
                          >
                            <ListItemIcon>
                              <FolderIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={volume.title}
                              secondary={volume.summary || undefined}
                            />
                          </MenuItem>
                        ))}
                      </Menu>
                    </Stack>
                  </Stack>
                )}
                {activeTab === "lores" && (
                  <StorytellerLoreManager projectPublicId={project.id} />
                )}
                {activeTab === "assets" && (
                  <StorytellerAssetManager projectPublicId={project.id} />
                )}
                {activeTab === "stories" &&
                (apiStoriesLoading || apiVolumesLoading) ? (
                  <StorytellerLoading
                    label={t("web.projectWorkspace.loadingStories")}
                  />
                ) : activeTab === "stories" &&
                  orderedStories.length === 0 &&
                  apiVolumes.length === 0 ? (
                  <CustomEmptyState
                    icon={<ArticleIcon fontSize="large" />}
                    title={t("web.projectWorkspace.empty.allTitle")}
                    description={t(
                      "web.projectWorkspace.empty.allDescription",
                    )}
                  />
                ) : activeTab === "stories" ? (
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        size="small"
                        variant={
                          activeStoryCollectionId === ""
                            ? "contained"
                            : "outlined"
                        }
                        startIcon={<FolderIcon />}
                        onClick={() => setActiveStoryCollectionId("")}
                      >
                        {t("web.common.all")}
                      </Button>
                      <Tooltip
                        title={t(
                          "web.projectWorkspace.volume.ungroupedDropHint",
                        )}
                      >
                        <Button
                          size="small"
                          variant={
                            activeStoryCollectionId ===
                            ungroupedStoryCollectionId
                              ? "contained"
                              : "outlined"
                          }
                          onClick={() =>
                            setActiveStoryCollectionId(
                              ungroupedStoryCollectionId,
                            )
                          }
                          onDragOver={handleUngroupedDragOver}
                          onDrop={handleUngroupedDrop}
                          sx={dropTargetSx(canDropDraggingStory(null))}
                        >
                          {t("web.projectWorkspace.volume.ungrouped")}
                        </Button>
                      </Tooltip>
                      {orderedVolumes.map((volume) => {
                        const storyCount = storyCountForVolume(volume.id);
                        const canDropHere = Boolean(
                          (draggingVolumeId &&
                            draggingVolumeId !== volume.public_id) ||
                          canDropDraggingStory(volume.id),
                        );
                        return (
                          <ButtonGroup
                            key={volume.public_id}
                            size="small"
                            draggable
                            onDragStart={() => {
                              setDraggingStoryId(null);
                              setDraggingVolumeId(volume.public_id);
                            }}
                            onDragEnd={() => setDraggingVolumeId(null)}
                            onDragOver={(event) =>
                              handleVolumeCollectionDragOver(event, volume)
                            }
                            onDrop={(event) =>
                              handleVolumeCollectionDrop(event, volume)
                            }
                            variant={
                              activeStoryCollectionId === volume.public_id
                                ? "contained"
                                : "outlined"
                            }
                            sx={{
                              ...dropTargetSx(canDropHere),
                              opacity:
                                draggingVolumeId === volume.public_id
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            <Tooltip
                              title={
                                volume.summary
                                  ? t(
                                      "web.projectWorkspace.volume.dropHintWithSummary",
                                      {
                                        title: volume.title,
                                        summary: volume.summary,
                                      },
                                    )
                                  : t("web.projectWorkspace.volume.dropHint", {
                                      title: volume.title,
                                    })
                              }
                            >
                              <Button
                                onClick={() =>
                                  setActiveStoryCollectionId(volume.public_id)
                                }
                                sx={{ maxWidth: 220 }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {volume.title}
                                </Box>
                                <Box
                                  component="span"
                                  sx={{ ml: 0.75, opacity: 0.72 }}
                                >
                                  {storyCount}
                                </Box>
                              </Button>
                            </Tooltip>
                            <Tooltip
                              title={
                                volume.status === "completed"
                                  ? t(
                                      "web.projectWorkspace.volume.unpublishHint",
                                    )
                                  : t(
                                      "web.projectWorkspace.volume.publishHint",
                                    )
                              }
                            >
                              <Button
                                disabled={patchStory.isPending}
                                onClick={() => toggleVolumeStatus(volume)}
                              >
                                {volume.status === "completed"
                                  ? t("web.projectWorkspace.status.public")
                                  : t(
                                      "web.projectWorkspace.status.unpublished",
                                    )}
                              </Button>
                            </Tooltip>
                            <Tooltip
                              title={t("web.projectWorkspace.volume.edit")}
                            >
                              <Button
                                onClick={() => setVolumeDialogTarget(volume)}
                              >
                                <EditIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                            <Tooltip
                              title={
                                storyCount > 0
                                  ? t(
                                      "web.projectWorkspace.volume.deleteBlocked",
                                    )
                                  : t("web.projectWorkspace.volume.delete")
                              }
                            >
                              <Button
                                color="error"
                                disabled={storyCount > 0}
                                onClick={() => setDeleteVolumeTarget(volume)}
                              >
                                <DeleteIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                          </ButtonGroup>
                        );
                      })}
                    </Stack>

                    {visibleStories.length === 0 ? (
                      <CustomEmptyState
                        icon={<ArticleIcon fontSize="large" />}
                        title={t("web.projectWorkspace.empty.groupTitle")}
                        description={t(
                          "web.projectWorkspace.empty.groupDescription",
                        )}
                      />
                    ) : (
                      <Stack spacing={1.5}>
                        {pagedStories.map((story) => renderStoryRow(story))}
                        {activeStoryCollectionId !== "" &&
                          activeStoryParentId !== undefined &&
                          renderDropEndZone(() =>
                            handleDropStory(activeStoryParentId, null),
                          )}
                        {storiesTotalPages > 1 && (
                          <Box
                            sx={{ display: "flex", justifyContent: "center" }}
                          >
                            <Pagination
                              count={storiesTotalPages}
                              page={storiesPage}
                              onChange={(_, value) => setStoriesPage(value)}
                              color="primary"
                            />
                          </Box>
                        )}
                      </Stack>
                    )}
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
      {deleteTarget && (
        <StorytellerConfirmNameDialog
          open
          title={
            deleteTarget.content_type === "image"
              ? t("web.projectWorkspace.story.deleteEpisode")
              : t("web.projectWorkspace.story.deleteStory")
          }
          description={
            deleteTarget.content_type === "image"
              ? t("web.projectWorkspace.story.deleteEpisodeDescription")
              : t("web.projectWorkspace.story.deleteStoryDescription")
          }
          confirmName={deleteTarget.title}
          confirmLabel={
            deleteTarget.content_type === "image"
              ? t("web.projectWorkspace.story.deleteEpisode")
              : t("web.projectWorkspace.story.deleteStory")
          }
          loading={deleteStory.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteTarget.public_id, {
              onSuccess: () => setDeleteTarget(null),
              onError: () =>
                notifyAction(
                  t("web.projectWorkspace.errors.storyDelete"),
                  "error",
                ),
            })
          }
        />
      )}
      <StorytellerVolumeDialog
        open={volumeDialogTarget !== null}
        initialTitle={
          volumeDialogTarget && volumeDialogTarget !== "new"
            ? volumeDialogTarget.title
            : undefined
        }
        loading={saveVolume.isPending}
        onClose={() => setVolumeDialogTarget(null)}
        onSubmit={(title) =>
          saveVolume.mutate(
            {
              volumePublicId:
                volumeDialogTarget && volumeDialogTarget !== "new"
                  ? volumeDialogTarget.public_id
                  : undefined,
              input: {
                title,
                sort:
                  volumeDialogTarget && volumeDialogTarget !== "new"
                    ? volumeDialogTarget.sort
                    : apiVolumes.length,
                status:
                  volumeDialogTarget && volumeDialogTarget !== "new"
                    ? volumeDialogTarget.status
                    : "completed",
                summary:
                  volumeDialogTarget && volumeDialogTarget !== "new"
                    ? volumeDialogTarget.summary
                    : "",
              },
            },
            {
              onSuccess: (savedVolume) => {
                if (volumeDialogTarget === "new" && savedVolume?.public_id) {
                  setActiveStoryCollectionId(savedVolume.public_id);
                  setStoriesPage(1);
                }
                setVolumeDialogTarget(null);
                notifyAction(
                  volumeDialogTarget === "new"
                    ? t("web.projectWorkspace.messages.volumeCreated")
                    : t("web.projectWorkspace.messages.volumeUpdated"),
                );
              },
              onError: () =>
                notifyAction(
                  t("web.projectWorkspace.errors.volumeSave"),
                  "error",
                ),
            },
          )
        }
      />
      {deleteVolumeTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.projectWorkspace.volume.delete")}
          description={t("web.projectWorkspace.volume.deleteDescription")}
          confirmName={deleteVolumeTarget.title}
          confirmLabel={t("web.projectWorkspace.volume.delete")}
          loading={deleteStory.isPending}
          onClose={() => setDeleteVolumeTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteVolumeTarget.public_id, {
              onSuccess: () => {
                if (activeStoryCollectionId === deleteVolumeTarget.public_id) {
                  setActiveStoryCollectionId("");
                }
                setDeleteVolumeTarget(null);
              },
              onError: () =>
                notifyAction(
                  t("web.projectWorkspace.errors.volumeDelete"),
                  "error",
                ),
            })
          }
        />
      )}
      {projectDeleteOpen && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.projectWorkspace.deleteProject")}
          description={t("web.projectWorkspace.deleteProjectDescription")}
          confirmName={project.name}
          confirmLabel={t("web.projectWorkspace.deleteProject")}
          loading={deleteProject.isPending}
          onClose={() => setProjectDeleteOpen(false)}
          onConfirm={() =>
            deleteProject.mutate(project.id, {
              onSuccess: () => navigate(steamloomPath("my/projects")),
              onError: () =>
                notifyAction(
                  t("web.projectWorkspace.errors.projectDelete"),
                  "error",
                ),
            })
          }
        />
      )}
    </StorytellerShell>
  );
}
