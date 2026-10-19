import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Button,
  ButtonGroup,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import axios from "axios";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  useDeleteStorytellerAsset,
  useDeleteStorytellerAssetCollection,
  useDeleteStorytellerLore,
  useDeleteStorytellerLoreCollection,
  useDeleteStorytellerStory,
  useMoveStorytellerAsset,
  useMoveStorytellerLore,
  useSaveStorytellerAssetCollection,
  useSaveStorytellerLoreCollection,
  usePatchStorytellerStory,
  useSaveStorytellerVolume,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerAssetUploadDrawer } from "./StorytellerAssetUploadDrawer.tsx";
import { StorytellerVolumeDialog } from "./StorytellerVolumeDialog.tsx";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import {
  CollectionDialog,
  MoveMenu,
} from "./ProjectWorkspacePreviewActionParts.tsx";
import {
  WorkspaceRowActionButton,
  WorkspaceRowActionMenu,
} from "./ProjectWorkspaceRowActions.tsx";
import {
  ungroupedId,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
  StorytellerLore,
  StorytellerLoreCollection,
  StorytellerStory,
} from "@/types/storyteller.ts";

interface WorkspaceListActionOptions {
  projectId?: string;
  selected: SelectedNode;
  stories: StorytellerStory[];
  volumes: StorytellerStory[];
  loreCollections: StorytellerLoreCollection[];
  assetCollections: StorytellerAssetCollection[];
  assetKeyword: string;
  onAssetKeywordChange: (keyword: string) => void;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
  onRefreshAssets: () => void;
  // 作品／設定刪除成功後通知頁面（側邊列可以刪掉正在編輯的那篇，頁面要負責離開編輯頁）
  onItemDeleted?: (type: "story" | "lore", publicId: string) => void;
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    return message || fallback;
  }
  return fallback;
}

export function useWorkspaceListActions(options: WorkspaceListActionOptions) {
  const {
    projectId,
    selected,
    stories,
    volumes,
    loreCollections,
    assetCollections,
    assetKeyword,
    onAssetKeywordChange,
    onSelect,
    onRefreshAssets,
    onItemDeleted,
  } = options;
  const { t } = useTranslation();
  const [snack, setSnackState] = useState<{
    message: string;
    severity: "success" | "error" | "info";
  }>({ message: "", severity: "info" });
  function setSnack(
    message: string,
    severity: "success" | "error" | "info" = "success",
  ) {
    setSnackState({ message, severity });
  }
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const createButtonGroupRef = useRef<HTMLDivElement | null>(null);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [volumeDialogTarget, setVolumeDialogTarget] = useState<
    StorytellerStory | "new" | null
  >(null);
  const [storyActionMenu, setStoryActionMenu] = useState<{
    anchorEl: HTMLElement;
    story: StorytellerStory;
  } | null>(null);
  const [loreActionMenu, setLoreActionMenu] = useState<{
    anchorEl: HTMLElement;
    lore: StorytellerLore;
  } | null>(null);
  const [storyMoveMenu, setStoryMoveMenu] = useState<{
    anchorEl: HTMLElement;
    story: StorytellerStory;
  } | null>(null);
  const [loreMoveMenu, setLoreMoveMenu] = useState<{
    anchorEl: HTMLElement;
    lore: StorytellerLore;
  } | null>(null);
  const [assetMoveMenu, setAssetMoveMenu] = useState<{
    anchorEl: HTMLElement;
    asset: StorytellerAsset;
  } | null>(null);
  const [deleteStoryTarget, setDeleteStoryTarget] =
    useState<StorytellerStory | null>(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] =
    useState<StorytellerStory | null>(null);
  const [deleteLoreTarget, setDeleteLoreTarget] =
    useState<StorytellerLore | null>(null);
  const [deleteAssetTarget, setDeleteAssetTarget] =
    useState<StorytellerAsset | null>(null);
  const [deleteAssetError, setDeleteAssetError] = useState("");
  const [loreCollectionTarget, setLoreCollectionTarget] = useState<
    StorytellerLoreCollection | "new" | null
  >(null);
  const [assetCollectionTarget, setAssetCollectionTarget] = useState<
    StorytellerAssetCollection | "new" | null
  >(null);
  const [deleteLoreCollectionTarget, setDeleteLoreCollectionTarget] =
    useState<StorytellerLoreCollection | null>(null);
  const [deleteAssetCollectionTarget, setDeleteAssetCollectionTarget] =
    useState<StorytellerAssetCollection | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");

  const deleteStory = useDeleteStorytellerStory(projectId);
  const saveVolume = useSaveStorytellerVolume(projectId);
  // 排序、移動到冊、狀態切換只送變動欄位（PATCH），後端不寫版本、不會拿舊內文蓋掉新內容
  const patchStory = usePatchStorytellerStory(projectId);
  const saveLoreCollection = useSaveStorytellerLoreCollection(projectId);
  const deleteLoreCollection = useDeleteStorytellerLoreCollection(projectId);
  const moveLore = useMoveStorytellerLore(projectId);
  const deleteLore = useDeleteStorytellerLore(projectId);
  const saveAssetCollection = useSaveStorytellerAssetCollection(projectId);
  const deleteAssetCollection = useDeleteStorytellerAssetCollection(projectId);
  const moveAsset = useMoveStorytellerAsset(projectId);
  const deleteAsset = useDeleteStorytellerAsset(projectId);

  function storyCountForVolume(parentId: number | null) {
    return stories.filter(
      (story) => !story.is_volume && story.parent_id === parentId,
    ).length;
  }

  function saveStoryPatch(
    story: StorytellerStory,
    patch: Partial<Pick<StorytellerStory, "sort" | "status" | "parent_id">>,
    onError: (error: unknown) => void,
    onSuccess?: () => void,
  ) {
    // 排序會在同一輪連續更新多筆；mutateAsync 讓每筆失敗都能進入各自的回呼。
    void patchStory
      .mutateAsync({
        storyPublicId: story.public_id,
        input: {
          sort: patch.sort,
          status: patch.status,
          // parent_id 是冊的內部 id，API 要的是冊的 public_id；不分冊送空字串
          parent_id:
            patch.parent_id !== undefined
              ? (volumes.find((volume) => volume.id === patch.parent_id)
                  ?.public_id ?? "")
              : undefined,
        },
      })
      .then(() => onSuccess?.())
      .catch((error: unknown) => onError(error));
  }

  function moveStoryToVolume(story: StorytellerStory, volumePublicId: string) {
    const targetVolume = volumePublicId
      ? volumes.find((volume) => volume.public_id === volumePublicId)
      : undefined;
    const nextParentId = targetVolume?.id ?? null;
    if (story.parent_id === nextParentId) {
      setStoryMoveMenu(null);
      return;
    }
    saveStoryPatch(
      story,
      {
        parent_id: nextParentId,
        sort: storyCountForVolume(nextParentId),
      },
      (error) => setSnack(errorMessage(error, t("web.projectWorkspace.errors.storyMove")), "error"),
      () => setSnack(t("web.projectWorkspace.messages.storyMoved")),
    );
    setStoryMoveMenu(null);
  }

  // 工作台的作品列表一次只顯示「目前選到的那一組」（某一冊、未分冊，或全部作品
  // 混在一起），跟舊版管理頁「所有冊＋未分冊同時攤開」的畫面不一樣，沒辦法直接
  // 把故事拖到另一個看不到的冊——跨冊搬移還是走既有的「移動到冊」選單。這裡只
  // 處理「同一組內」重新排序：把 draggedPublicId 插到 beforePublicId 前面
  // （null 代表插到最後），只送真的動到 sort 的那幾筆存檔請求。
  // collectionId：要排序的那一組（冊的 public_id 或 ungroupedId）；預設是目前列表選到的分組，
  // 側邊列排序模式會指定作品所在的冊。
  function reorderStory(
    draggedPublicId: string,
    beforePublicId: string | null,
    collectionId: string = selected.collectionId,
  ) {
    if (draggedPublicId === beforePublicId) {
      return;
    }
    const parentId =
      collectionId === ungroupedId
        ? null
        : (volumes.find((volume) => volume.public_id === collectionId)?.id ??
          null);
    const group = stories
      .filter((story) => !story.is_volume && story.parent_id === parentId)
      .sort((left, right) => left.sort - right.sort);
    const dragged = group.find((story) => story.public_id === draggedPublicId);
    if (!dragged) {
      return;
    }
    const remaining = group.filter(
      (story) => story.public_id !== draggedPublicId,
    );
    const insertIndex = beforePublicId
      ? remaining.findIndex((story) => story.public_id === beforePublicId)
      : remaining.length;
    remaining.splice(
      insertIndex < 0 ? remaining.length : insertIndex,
      0,
      dragged,
    );
    remaining.forEach((story, index) => {
      if (story.sort !== index) {
        saveStoryPatch(story, { sort: index }, (error) =>
          setSnack(errorMessage(error, t("web.projectWorkspace.errors.storyReorder")), "error"),
        );
      }
    });
  }

  // 冊本身是側邊欄裡一個扁平清單（不像作品列表會依目前選到的分組而被過濾／分頁），
  // 拖曳排序不用像 reorderStory 那樣先框出「同一組」，直接在全部冊之間重新插入
  // 位置即可，邏輯比照舊版管理頁的 handleDropVolume。
  function reorderVolume(
    draggedPublicId: string,
    beforePublicId: string | null,
  ) {
    if (draggedPublicId === beforePublicId) {
      return;
    }
    const ordered = [...volumes].sort((left, right) => left.sort - right.sort);
    const dragged = ordered.find(
      (volume) => volume.public_id === draggedPublicId,
    );
    if (!dragged) {
      return;
    }
    const remaining = ordered.filter(
      (volume) => volume.public_id !== draggedPublicId,
    );
    const insertIndex = beforePublicId
      ? remaining.findIndex((volume) => volume.public_id === beforePublicId)
      : remaining.length;
    remaining.splice(
      insertIndex < 0 ? remaining.length : insertIndex,
      0,
      dragged,
    );
    remaining.forEach((volume, index) => {
      if (volume.sort === index) {
        return;
      }
      void patchStory
        .mutateAsync({
          storyPublicId: volume.public_id,
          input: { sort: index },
        })
        .catch((error: unknown) =>
          setSnack(errorMessage(error, t("web.projectWorkspace.errors.volumeReorder")), "error"),
        );
    });
  }

  // 設定集本身已有 sort 欄位與 update endpoint；跟冊維持相同的同層排序語意，
  // 不讓 mobile Drawer 另外共用樹狀導覽後反而失去設定集排序能力。
  function reorderLoreCollection(
    draggedPublicId: string,
    beforePublicId: string | null,
  ) {
    if (draggedPublicId === beforePublicId) return;
    const ordered = [...loreCollections].sort(
      (left, right) => left.sort - right.sort,
    );
    const dragged = ordered.find(
      (collection) => collection.public_id === draggedPublicId,
    );
    if (!dragged) return;
    const remaining = ordered.filter(
      (collection) => collection.public_id !== draggedPublicId,
    );
    const insertIndex = beforePublicId
      ? remaining.findIndex(
          (collection) => collection.public_id === beforePublicId,
        )
      : remaining.length;
    remaining.splice(
      insertIndex < 0 ? remaining.length : insertIndex,
      0,
      dragged,
    );
    remaining.forEach((collection, index) => {
      if (collection.sort === index) return;
      void saveLoreCollection
        .mutateAsync({
          collectionPublicId: collection.public_id,
          input: {
            name: collection.name,
            description: collection.description,
            sort: index,
          },
        })
        .catch((error: unknown) =>
          setSnack(errorMessage(error, t("web.workspacePreview.actions.loreCollectionReorderFailed")), "error"),
        );
    });
  }

  function toggleVolumeStatus(volume: StorytellerStory) {
    patchStory.mutate(
      {
        storyPublicId: volume.public_id,
        input: {
          status: volume.status === "completed" ? "draft" : "completed",
        },
      },
      {
        onSuccess: () =>
          setSnack(
            volume.status === "completed"
              ? t("web.projectWorkspace.messages.volumeUnpublished")
              : t("web.projectWorkspace.messages.volumePublished"),
          ),
        onError: (error) =>
          setSnack(errorMessage(error, t("web.projectWorkspace.errors.volumeStatus")), "error"),
      },
    );
  }

  function openCollectionDialog(
    type: "lore" | "asset",
    target: StorytellerLoreCollection | StorytellerAssetCollection | "new",
  ) {
    setCollectionName(target === "new" ? "" : target.name);
    setCollectionDescription(target === "new" ? "" : target.description);
    if (type === "lore")
      setLoreCollectionTarget(target as StorytellerLoreCollection | "new");
    if (type === "asset") {
      setAssetCollectionTarget(target as StorytellerAssetCollection | "new");
    }
  }

  async function submitLoreCollection() {
    if (!collectionName.trim()) return;
    const target = loreCollectionTarget;
    try {
      const saved = await saveLoreCollection.mutateAsync({
        collectionPublicId:
          target && target !== "new" ? target.public_id : undefined,
        input: {
          name: collectionName.trim(),
          description: collectionDescription,
        },
      });
      if (target === "new" && saved?.public_id)
        onSelect("lores", saved.public_id);
      setLoreCollectionTarget(null);
      setSnack(target === "new"
          ? t("web.loreManager.messages.collectionCreated")
          : t("web.loreManager.messages.collectionUpdated"));
    } catch (error) {
      setSnack(errorMessage(error, t("web.workspacePreview.actions.loreCollectionSaveFailed")), "error");
    }
  }

  async function submitAssetCollection() {
    if (!collectionName.trim()) return;
    const target = assetCollectionTarget;
    try {
      const saved = await saveAssetCollection.mutateAsync({
        collectionPublicId:
          target && target !== "new" ? target.public_id : undefined,
        input: {
          name: collectionName.trim(),
          description: collectionDescription,
          sort:
            target && target !== "new"
              ? target.sort
              : assetCollections.length * 10,
        },
      });
      if (target === "new" && saved?.public_id)
        onSelect("assets", saved.public_id);
      setAssetCollectionTarget(null);
      setSnack(target === "new"
          ? t("web.assetManager.messages.collectionCreated")
          : t("web.assetManager.messages.collectionUpdated"));
    } catch (error) {
      setSnack(errorMessage(error, t("web.assetManager.errors.collectionSave")), "error");
    }
  }

  async function moveLoreTo(lore: StorytellerLore, collectionId: string) {
    if ((lore.collection_id ?? "") === collectionId)
      return setLoreMoveMenu(null);
    try {
      await moveLore.mutateAsync({
        lorePublicId: lore.public_id,
        collectionId,
      });
      setLoreMoveMenu(null);
      setSnack(t("web.workspacePreview.actions.loreMoved"));
    } catch (error) {
      setSnack(errorMessage(error, t("web.workspacePreview.actions.loreMoveFailed")), "error");
    }
  }

  async function moveAssetTo(asset: StorytellerAsset, collectionId: string) {
    if ((asset.collection_id ?? "") === collectionId)
      return setAssetMoveMenu(null);
    try {
      await moveAsset.mutateAsync({
        assetPublicId: asset.public_id,
        collectionId,
      });
      setAssetMoveMenu(null);
      setSnack(t("web.assetManager.messages.assetMoved"));
    } catch (error) {
      setSnack(errorMessage(error, t("web.assetManager.errors.assetMove")), "error");
    }
  }

  const uploadDrawerCollectionId =
    selected.section === "assets" &&
    selected.collectionId &&
    selected.collectionId !== ungroupedId
      ? selected.collectionId
      : "";

  // 帶去故事/圖像/設定集編輯器路由的查詢參數：一方面讓新建作品能預設放進目前
  // 瀏覽的冊/分類，一方面讓編輯器畫面底下的側邊欄高亮／麵包屑／「回列表」都能
  // 對回目前這個分組（見 ProjectWorkspacePreview.tsx 的 selected 推導邏輯）。
  const fromQuery = selected.collectionId
    ? `?from=${encodeURIComponent(selected.collectionId)}`
    : "";
  const currentVolume = volumes.find(
    (volume) => volume.public_id === selected.collectionId,
  );
  const currentLoreCollection = loreCollections.find(
    (collection) => collection.public_id === selected.collectionId,
  );
  const currentAssetCollection = assetCollections.find(
    (collection) => collection.public_id === selected.collectionId,
  );

  const titleActions =
    currentVolume && selected.section === "stories" ? (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Tooltip
          title={
            currentVolume.status === "completed"
              ? t("web.projectWorkspace.volume.unpublishHint")
              : t("web.projectWorkspace.volume.publishHint")
          }
        >
          <span>
            <Button
              size="small"
              variant={
                currentVolume.status === "completed" ? "contained" : "outlined"
              }
              color={
                currentVolume.status === "completed" ? "primary" : "inherit"
              }
              disabled={patchStory.isPending}
              onClick={() => toggleVolumeStatus(currentVolume)}
              sx={{
                minHeight: 24,
                px: 1,
                py: 0.1,
                borderRadius: 1,
                fontWeight: 800,
              }}
            >
              {currentVolume.status === "completed"
                ? t("web.workspacePreview.actions.volumePublicChip")
                : t("web.workspacePreview.actions.volumeDraftChip")}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={t("web.workspacePreview.actions.renameVolume")}>
          <IconButton
            size="small"
            onClick={() => setVolumeDialogTarget(currentVolume)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("web.projectWorkspace.volume.delete")}>
          <IconButton
            size="small"
            color="error"
            onClick={() => setDeleteVolumeTarget(currentVolume)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    ) : currentLoreCollection && selected.section === "lores" ? (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title={t("web.loreManager.collection.edit")}>
          <IconButton
            size="small"
            onClick={() => openCollectionDialog("lore", currentLoreCollection)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("web.loreManager.collection.delete")}>
          <IconButton
            size="small"
            color="error"
            onClick={() => setDeleteLoreCollectionTarget(currentLoreCollection)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    ) : currentAssetCollection && selected.section === "assets" ? (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title={t("web.assetManager.collection.edit")}>
          <IconButton
            size="small"
            onClick={() =>
              openCollectionDialog("asset", currentAssetCollection)
            }
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("web.assetManager.collection.delete")}>
          <IconButton
            size="small"
            color="error"
            onClick={() =>
              setDeleteAssetCollectionTarget(currentAssetCollection)
            }
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    ) : undefined;

  const actions =
    selected.section === "stories" ? (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <ButtonGroup ref={createButtonGroupRef} variant="contained">
          <Button
            onClick={() => setCreateMenuAnchor(createButtonGroupRef.current)}
          >
            {t("web.common.create")}
          </Button>
          <Button
            size="small"
            onClick={() => setCreateMenuAnchor(createButtonGroupRef.current)}
            sx={{ px: 0.5 }}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
      </Stack>
    ) : selected.section === "lores" ? (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          component={RouterLink}
          to={steamloomPath(`my/workspace/${projectId}/lore/new${fromQuery}`)}
          variant="contained"
        >
          {t("web.loreManager.createLore")}
        </Button>
      </Stack>
    ) : (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label={t("web.assetManager.search")}
          value={assetKeyword}
          onChange={(event) => onAssetKeywordChange(event.target.value)}
        />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefreshAssets}
        >
          {t("web.assetManager.refresh")}
        </Button>
        <Button
          variant="contained"
          startIcon={<FileUploadIcon />}
          onClick={() => setUploadDrawerOpen(true)}
        >
          {t("web.workspacePreview.actions.uploadImage")}
        </Button>
      </Stack>
    );

  // 手機斷點下觸控目標容易太小太擠（原本 IconButton size="small" 加上緊貼的
  // 間距，實測約 30x30px 且互相黏在一起），桌面滑鼠操作不需要放大，只在 xs
  // 斷點加大 padding／間距，其餘尺寸不變。
  const touchTargetSx = { p: { xs: 1.25, sm: 0.625 } };

  // dense：側邊列用的小尺寸；列表與側邊列打開的是同一份選單
  const renderStoryActions = (story: StorytellerStory, dense?: boolean) => (
    <WorkspaceRowActionButton
      label={t("web.workspacePreview.actions.storyActions")}
      dense={dense}
      onOpen={(event) =>
        setStoryActionMenu({ anchorEl: event.currentTarget, story })
      }
    />
  );

  const renderLoreActions = (lore: StorytellerLore, dense?: boolean) => (
    <WorkspaceRowActionButton
      label={t("web.workspacePreview.actions.loreActions")}
      dense={dense}
      onOpen={(event) =>
        setLoreActionMenu({ anchorEl: event.currentTarget, lore })
      }
    />
  );

  const renderAssetActions = (asset: StorytellerAsset) => (
    <Stack direction="row" spacing={{ xs: 1, sm: 0.25 }}>
      <Tooltip title={t("web.workspacePreview.actions.moveAsset")}>
        <IconButton
          size="small"
          sx={touchTargetSx}
          onClick={(event) =>
            setAssetMoveMenu({ anchorEl: event.currentTarget, asset })
          }
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip
        title={
          asset.reference_count > 0
            ? t("web.assetManager.deleteBlocked")
            : t("web.assetManager.deleteAsset")
        }
      >
        <span>
          <IconButton
            size="small"
            sx={touchTargetSx}
            color="error"
            disabled={asset.reference_count > 0}
            onClick={() => {
              setDeleteAssetError("");
              setDeleteAssetTarget(asset);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  const dialogs: ReactNode = (
    <>
      <Menu
        anchorEl={createMenuAnchor}
        open={Boolean(createMenuAnchor)}
        onClose={() => setCreateMenuAnchor(null)}
      >
        <MenuItem
          component={RouterLink}
          to={steamloomPath(`my/workspace/${projectId}/story/new${fromQuery}`)}
          onClick={() => setCreateMenuAnchor(null)}
        >
          <ListItemIcon>
            <ArticleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("web.projectWorkspace.story.text")}</ListItemText>
        </MenuItem>
        <MenuItem
          component={RouterLink}
          to={steamloomPath(`my/workspace/${projectId}/image/new${fromQuery}`)}
          onClick={() => setCreateMenuAnchor(null)}
        >
          <ListItemIcon>
            <CollectionsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("web.projectWorkspace.story.image")}</ListItemText>
        </MenuItem>
      </Menu>
      <WorkspaceRowActionMenu
        anchorEl={storyActionMenu?.anchorEl ?? null}
        moveLabel={t("web.workspacePreview.actions.moveToVolume")}
        deleteLabel={t("web.projectWorkspace.story.delete")}
        status={storyActionMenu?.story.status}
        disabled={patchStory.isPending}
        onClose={() => setStoryActionMenu(null)}
        onToggleStatus={() => {
          if (storyActionMenu) {
            const completed = storyActionMenu.story.status !== "completed";
            saveStoryPatch(
              storyActionMenu.story,
              { status: completed ? "completed" : "draft" },
              (error) =>
                setSnack(errorMessage(error, t("web.projectWorkspace.errors.storyStatus")), "error"),
              () => setSnack(
                  completed
                    ? t("web.projectWorkspace.messages.storyPublished")
                    : t("web.projectWorkspace.messages.storyUnpublished"),
                ),
            );
          }
          setStoryActionMenu(null);
        }}
        onMove={() => {
          if (storyActionMenu) setStoryMoveMenu(storyActionMenu);
          setStoryActionMenu(null);
        }}
        onDelete={() => {
          setDeleteStoryTarget(storyActionMenu?.story ?? null);
          setStoryActionMenu(null);
        }}
      />
      <WorkspaceRowActionMenu
        anchorEl={loreActionMenu?.anchorEl ?? null}
        moveLabel={t("web.workspacePreview.actions.moveToLoreCollection")}
        deleteLabel={t("web.loreManager.deleteLore")}
        onClose={() => setLoreActionMenu(null)}
        onMove={() => {
          if (loreActionMenu) setLoreMoveMenu(loreActionMenu);
          setLoreActionMenu(null);
        }}
        onDelete={() => {
          setDeleteLoreTarget(loreActionMenu?.lore ?? null);
          setLoreActionMenu(null);
        }}
      />
      <MoveMenu
        anchorEl={storyMoveMenu?.anchorEl ?? null}
        open={Boolean(storyMoveMenu)}
        disabled={patchStory.isPending}
        currentId={storyMoveMenu?.story.parent_id ?? null}
        rows={volumes.map((volume) => ({
          id: volume.id,
          publicId: volume.public_id,
          name: volume.title,
        }))}
        ungroupedLabel={t("web.projectWorkspace.story.moveUngrouped")}
        onClose={() => setStoryMoveMenu(null)}
        onMove={(collectionId) =>
          storyMoveMenu && moveStoryToVolume(storyMoveMenu.story, collectionId)
        }
      />
      <MoveMenu
        anchorEl={loreMoveMenu?.anchorEl ?? null}
        open={Boolean(loreMoveMenu)}
        disabled={moveLore.isPending}
        currentId={loreMoveMenu?.lore.collection_id ?? ""}
        rows={loreCollections.map((collection) => ({
          id: collection.public_id,
          publicId: collection.public_id,
          name: collection.name,
        }))}
        ungroupedLabel={t("web.loreManager.moveUncategorized")}
        onClose={() => setLoreMoveMenu(null)}
        onMove={(collectionId) =>
          loreMoveMenu && void moveLoreTo(loreMoveMenu.lore, collectionId)
        }
      />
      <MoveMenu
        anchorEl={assetMoveMenu?.anchorEl ?? null}
        open={Boolean(assetMoveMenu)}
        disabled={moveAsset.isPending}
        currentId={assetMoveMenu?.asset.collection_id ?? ""}
        rows={assetCollections.map((collection) => ({
          id: collection.public_id,
          publicId: collection.public_id,
          name: collection.name,
        }))}
        ungroupedLabel={t("web.assetManager.moveUncategorized")}
        onClose={() => setAssetMoveMenu(null)}
        onMove={(collectionId) =>
          assetMoveMenu && void moveAssetTo(assetMoveMenu.asset, collectionId)
        }
      />
      <StorytellerAssetUploadDrawer
        open={uploadDrawerOpen}
        projectPublicId={projectId ?? ""}
        collectionId={uploadDrawerCollectionId}
        onClose={() => setUploadDrawerOpen(false)}
        onUploaded={() => onRefreshAssets()}
        onNotify={(message, severity) => setSnack(message, severity)}
      />
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
                    : volumes.length,
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
              onSuccess: (saved) => {
                if (volumeDialogTarget === "new" && saved?.public_id)
                  onSelect("stories", saved.public_id);
                setVolumeDialogTarget(null);
                setSnack(
                  volumeDialogTarget === "new"
                    ? t("web.projectWorkspace.messages.volumeCreated")
                    : t("web.projectWorkspace.messages.volumeUpdated"),
                );
              },
              onError: (error) =>
                setSnack(errorMessage(error, t("web.projectWorkspace.errors.volumeSave")), "error"),
            },
          )
        }
      />
      <CollectionDialog
        open={Boolean(loreCollectionTarget || assetCollectionTarget)}
        title={
          loreCollectionTarget
            ? t("web.projectWorkspace.tabs.lores")
            : t("web.projectWorkspace.tabs.assets")
        }
        name={collectionName}
        description={collectionDescription}
        loading={saveLoreCollection.isPending || saveAssetCollection.isPending}
        onNameChange={setCollectionName}
        onDescriptionChange={setCollectionDescription}
        onClose={() => {
          setLoreCollectionTarget(null);
          setAssetCollectionTarget(null);
        }}
        onSubmit={() =>
          loreCollectionTarget
            ? void submitLoreCollection()
            : void submitAssetCollection()
        }
      />
      {deleteStoryTarget && (
        <StorytellerConfirmNameDialog
          open
          title={
            deleteStoryTarget.content_type === "image"
              ? t("web.projectWorkspace.story.deleteEpisode")
              : t("web.projectWorkspace.story.deleteStory")
          }
          description={
            deleteStoryTarget.content_type === "image"
              ? t("web.projectWorkspace.story.deleteEpisodeDescription")
              : t("web.projectWorkspace.story.deleteStoryDescription")
          }
          confirmName={deleteStoryTarget.title}
          confirmLabel={t("web.projectWorkspace.story.delete")}
          loading={deleteStory.isPending}
          onClose={() => setDeleteStoryTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteStoryTarget.public_id, {
              onSuccess: () => {
                onItemDeleted?.("story", deleteStoryTarget.public_id);
                setDeleteStoryTarget(null);
                setSnack(t("web.workspacePreview.actions.storyDeleted"));
              },
              onError: (error) =>
                setSnack(errorMessage(error, t("web.projectWorkspace.errors.storyDelete")), "error"),
            })
          }
        />
      )}
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
                if (selected.collectionId === deleteVolumeTarget.public_id) {
                  onSelect("stories", "");
                }
                setDeleteVolumeTarget(null);
                setSnack(t("web.workspacePreview.actions.volumeDeleted"));
              },
              onError: (error) =>
                setSnack(errorMessage(error, t("web.projectWorkspace.errors.volumeDelete")), "error"),
            })
          }
        />
      )}
      {deleteLoreTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.loreManager.deleteLore")}
          description={t("web.loreManager.deleteLoreDescription")}
          confirmName={deleteLoreTarget.title}
          confirmLabel={t("web.loreManager.deleteLore")}
          loading={deleteLore.isPending}
          onClose={() => setDeleteLoreTarget(null)}
          onConfirm={() =>
            deleteLore.mutate(deleteLoreTarget.public_id, {
              onSuccess: () => {
                onItemDeleted?.("lore", deleteLoreTarget.public_id);
                setDeleteLoreTarget(null);
                setSnack(t("web.loreManager.messages.loreDeleted"));
              },
              onError: (error) =>
                setSnack(errorMessage(error, t("web.workspacePreview.actions.loreDeleteFailed")), "error"),
            })
          }
        />
      )}
      {deleteAssetTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.assetManager.deleteAsset")}
          description={t("web.workspacePreview.actions.deleteAssetDescription")}
          confirmName={storytellerAssetTitle(deleteAssetTarget)}
          confirmLabel={t("web.assetManager.deleteAsset")}
          loading={deleteAsset.isPending}
          error={deleteAssetError}
          onClose={() => {
            setDeleteAssetTarget(null);
            setDeleteAssetError("");
          }}
          onConfirm={() =>
            deleteAsset.mutate(deleteAssetTarget.public_id, {
              onSuccess: () => {
                setDeleteAssetTarget(null);
                setSnack(t("web.assetManager.messages.assetDeleted"));
              },
              onError: (error) => {
                const message = errorMessage(error, t("web.assetManager.errors.assetDelete"));
                setDeleteAssetError(message);
                setSnack(message, "error");
              },
            })
          }
        />
      )}
      {deleteLoreCollectionTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.loreManager.collection.delete")}
          description={t("web.loreManager.collection.deleteDescription")}
          confirmName={deleteLoreCollectionTarget.name}
          confirmLabel={t("web.loreManager.collection.delete")}
          loading={deleteLoreCollection.isPending}
          onClose={() => setDeleteLoreCollectionTarget(null)}
          onConfirm={() =>
            deleteLoreCollection.mutate(deleteLoreCollectionTarget.public_id, {
              onSuccess: () => {
                if (
                  selected.collectionId === deleteLoreCollectionTarget.public_id
                ) {
                  onSelect("lores", "");
                }
                setDeleteLoreCollectionTarget(null);
                setSnack(t("web.loreManager.messages.collectionDeleted"));
              },
              onError: (error) =>
                setSnack(errorMessage(error, t("web.workspacePreview.actions.loreCollectionDeleteFailed")), "error"),
            })
          }
        />
      )}
      {deleteAssetCollectionTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.assetManager.collection.delete")}
          description={t("web.workspacePreview.actions.deleteAssetCollectionDescription")}
          confirmName={deleteAssetCollectionTarget.name}
          confirmLabel={t("web.assetManager.collection.delete")}
          loading={deleteAssetCollection.isPending}
          onClose={() => setDeleteAssetCollectionTarget(null)}
          onConfirm={() =>
            deleteAssetCollection.mutate(
              deleteAssetCollectionTarget.public_id,
              {
                onSuccess: () => {
                  if (
                    selected.collectionId ===
                    deleteAssetCollectionTarget.public_id
                  ) {
                    onSelect("assets", "");
                  }
                  setDeleteAssetCollectionTarget(null);
                  setSnack(t("web.assetManager.messages.collectionDeleted"));
                },
                onError: (error) =>
                  setSnack(errorMessage(error, t("web.assetManager.errors.collectionDelete")), "error"),
              },
            )
          }
        />
      )}
      <CustomSnackbar
        open={Boolean(snack.message)}
        message={snack.message}
        severity={snack.severity}
        onClose={() => setSnack("")}
      />
    </>
  );

  return {
    actions,
    titleActions,
    dialogs,
    renderStoryActions,
    renderLoreActions,
    renderAssetActions,
    reorderStory,
    reorderVolume,
    reorderLoreCollection,
    onCreateVolume: () => setVolumeDialogTarget("new"),
    onCreateLoreCollection: () => openCollectionDialog("lore", "new"),
    onCreateAssetCollection: () => openCollectionDialog("asset", "new"),
  };
}
