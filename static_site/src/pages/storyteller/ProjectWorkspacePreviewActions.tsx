import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import axios from "axios";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  useSaveStorytellerStory,
  useSaveStorytellerVolume,
  useUpdateStorytellerAsset,
  useUploadStorytellerAssets,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
  STORYTELLER_IMAGE_PAGE_MAX_COUNT,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerVolumeDialog } from "./StorytellerVolumeDialog.tsx";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import {
  AssetEditDialog,
  CollectionDialog,
  MoveMenu,
  UploadProgressToast,
  WorkspaceConfirmNameDialog,
  type WorkspaceUploadProgressRow,
} from "./ProjectWorkspacePreviewActionParts.tsx";
import {
  ungroupedId,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
  StorytellerAssetUpdateRequest,
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
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    return message || fallback;
  }
  return fallback;
}

function assetEditForm(asset: StorytellerAsset): StorytellerAssetUpdateRequest {
  return {
    title: asset.title,
    alt_text: asset.alt_text,
    description: asset.description,
    metadata: asset.metadata ?? {},
  };
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
  } = options;
  const [snack, setSnack] = useState("");
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const createButtonGroupRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [volumeDialogTarget, setVolumeDialogTarget] = useState<
    StorytellerStory | "new" | null
  >(null);
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
  const [editingAsset, setEditingAsset] = useState<StorytellerAsset | null>(
    null,
  );
  const [assetForm, setAssetForm] =
    useState<StorytellerAssetUpdateRequest | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading">("idle");
  const [uploadProgress, setUploadProgress] = useState<
    Record<number, WorkspaceUploadProgressRow>
  >({});

  const saveStory = useSaveStorytellerStory(projectId);
  const deleteStory = useDeleteStorytellerStory(projectId);
  const saveVolume = useSaveStorytellerVolume(projectId);
  const saveLoreCollection = useSaveStorytellerLoreCollection(projectId);
  const deleteLoreCollection = useDeleteStorytellerLoreCollection(projectId);
  const moveLore = useMoveStorytellerLore(projectId);
  const deleteLore = useDeleteStorytellerLore(projectId);
  const saveAssetCollection = useSaveStorytellerAssetCollection(projectId);
  const deleteAssetCollection = useDeleteStorytellerAssetCollection(projectId);
  const moveAsset = useMoveStorytellerAsset(projectId);
  const updateAsset = useUpdateStorytellerAsset(projectId);
  const deleteAsset = useDeleteStorytellerAsset(projectId);
  const uploadAssets = useUploadStorytellerAssets(projectId);

  useEffect(() => {
    if (uploadPhase !== "uploading") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadPhase]);

  function storyParentPublicId(story: StorytellerStory) {
    return (
      volumes.find((volume) => volume.id === story.parent_id)?.public_id ?? ""
    );
  }

  function storyCountForVolume(parentId: number | null) {
    return stories.filter(
      (story) => !story.is_volume && story.parent_id === parentId,
    ).length;
  }

  function saveStoryPatch(
    story: StorytellerStory,
    patch: Partial<StorytellerStory>,
  ) {
    saveStory.mutate({
      storyPublicId: story.public_id,
      input: {
        title: patch.title ?? story.title,
        summary: patch.summary ?? story.summary,
        status: patch.status ?? story.status,
        sort: patch.sort ?? story.sort,
        content: patch.latest_content ?? story.latest_content,
        parent_id:
          patch.parent_id !== undefined
            ? (volumes.find((volume) => volume.id === patch.parent_id)
                ?.public_id ?? "")
            : storyParentPublicId(story),
      },
    });
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
    saveStoryPatch(story, {
      parent_id: nextParentId,
      sort: storyCountForVolume(nextParentId),
    });
    setStoryMoveMenu(null);
  }

  function toggleVolumeStatus(volume: StorytellerStory) {
    saveVolume.mutate(
      {
        volumePublicId: volume.public_id,
        input: {
          title: volume.title,
          sort: volume.sort,
          status: volume.status === "completed" ? "draft" : "completed",
          summary: volume.summary,
        },
      },
      {
        onError: (error) => setSnack(errorMessage(error, "冊狀態更新失敗。")),
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
      setSnack(target === "new" ? "分類已建立。" : "分類已更新。");
    } catch (error) {
      setSnack(errorMessage(error, "分類儲存失敗。"));
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
      setSnack(target === "new" ? "資產集已建立。" : "資產集已更新。");
    } catch (error) {
      setSnack(errorMessage(error, "資產集儲存失敗。"));
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
      setSnack("設定集已移動。");
    } catch (error) {
      setSnack(errorMessage(error, "設定集移動失敗。"));
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
      setSnack("資產已移動。");
    } catch (error) {
      setSnack(errorMessage(error, "資產移動失敗。"));
    }
  }

  async function handleFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    const accepted = selectedFiles.filter(
      (file) =>
        STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type) &&
        file.size <= STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const images = accepted.slice(0, STORYTELLER_IMAGE_PAGE_MAX_COUNT);
    if (images.length === 0) {
      setSnack("請選擇圖片檔案。");
      return;
    }
    if (images.length !== selectedFiles.length) {
      setSnack("部分檔案未上傳：僅接受符合大小限制的 JPEG／PNG／WebP／GIF。");
    }
    setUploadPhase("uploading");
    setUploadProgress(
      Object.fromEntries(
        images.map((file, index) => [
          index,
          { name: file.name, loaded: 0, total: file.size },
        ]),
      ),
    );
    try {
      const uploaded = await uploadAssets.mutateAsync({
        files: images,
        collectionId:
          selected.section === "assets" &&
          selected.collectionId &&
          selected.collectionId !== ungroupedId
            ? selected.collectionId
            : "",
        onProgress: (index, loaded, total) =>
          setUploadProgress((current) => ({
            ...current,
            [index]: {
              name: current[index]?.name ?? images[index]?.name ?? "",
              loaded,
              total,
            },
          })),
      });
      setSnack(`已上傳 ${uploaded.length} 個資產。`);
    } catch (error) {
      setSnack(errorMessage(error, "資產上傳失敗，請稍後再試。"));
    } finally {
      setUploadPhase("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const currentVolume = volumes.find(
    (volume) => volume.public_id === selected.collectionId,
  );
  const currentLoreCollection = loreCollections.find(
    (collection) => collection.public_id === selected.collectionId,
  );
  const currentAssetCollection = assetCollections.find(
    (collection) => collection.public_id === selected.collectionId,
  );

  const progressRows = Object.values(uploadProgress);
  const titleActions =
    currentVolume && selected.section === "stories" ? (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Tooltip
          title={
            currentVolume.status === "completed"
              ? "目前公開，點擊改為草稿"
              : "目前草稿，點擊公開"
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
              disabled={saveVolume.isPending}
              onClick={() => toggleVolumeStatus(currentVolume)}
              sx={{
                minHeight: 24,
                px: 1,
                py: 0.1,
                borderRadius: 1,
                fontWeight: 800,
              }}
            >
              {currentVolume.status === "completed" ? "公開冊" : "草稿冊"}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="重新命名冊">
          <IconButton
            size="small"
            onClick={() => setVolumeDialogTarget(currentVolume)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="刪除冊">
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
        <Tooltip title="編輯分類">
          <IconButton
            size="small"
            onClick={() => openCollectionDialog("lore", currentLoreCollection)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="刪除分類">
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
        <Tooltip title="編輯資產集">
          <IconButton
            size="small"
            onClick={() =>
              openCollectionDialog("asset", currentAssetCollection)
            }
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="刪除資產集">
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
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => setVolumeDialogTarget("new")}
        >
          新增冊
        </Button>
        <ButtonGroup ref={createButtonGroupRef} variant="contained">
          <Button
            onClick={() => setCreateMenuAnchor(createButtonGroupRef.current)}
          >
            建立
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
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => openCollectionDialog("lore", "new")}
        >
          建立分類
        </Button>
        <Button
          component={RouterLink}
          to={steamloomPath(`my/project/${projectId}/lore/new`)}
          variant="contained"
        >
          建立設定集
        </Button>
      </Stack>
    ) : (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="搜尋資產"
          value={assetKeyword}
          onChange={(event) => onAssetKeywordChange(event.target.value)}
        />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefreshAssets}
        >
          重新整理
        </Button>
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => openCollectionDialog("asset", "new")}
        >
          建立資產集
        </Button>
        <Button
          variant="contained"
          startIcon={<FileUploadIcon />}
          disabled={uploadPhase === "uploading"}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadPhase === "uploading" ? "上傳中" : "上傳圖像"}
        </Button>
        <Box
          component="input"
          ref={fileInputRef}
          type="file"
          accept={STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.join(",")}
          multiple
          sx={{ display: "none" }}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </Stack>
    );

  const renderStoryActions = (story: StorytellerStory) => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={story.status === "completed" ? "改為草稿" : "公開"}>
        <span>
          <Switch
            size="small"
            checked={story.status === "completed"}
            disabled={saveStory.isPending}
            onChange={(_, checked) =>
              saveStoryPatch(story, { status: checked ? "completed" : "draft" })
            }
          />
        </span>
      </Tooltip>
      <Tooltip title="編輯作品">
        <IconButton
          size="small"
          component={RouterLink}
          to={steamloomPath(
            `my/workspace/${projectId}/${story.content_type === "image" ? "image" : "story"}/${story.public_id}`,
          )}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="移動到冊">
        <IconButton
          size="small"
          onClick={(event) =>
            setStoryMoveMenu({ anchorEl: event.currentTarget, story })
          }
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="刪除作品">
        <IconButton
          size="small"
          color="error"
          onClick={() => setDeleteStoryTarget(story)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderLoreActions = (lore: StorytellerLore) => (
    <Stack direction="row" spacing={0.5}>
      <Tooltip title="移動設定集">
        <IconButton
          size="small"
          onClick={(event) =>
            setLoreMoveMenu({ anchorEl: event.currentTarget, lore })
          }
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="編輯設定集">
        <IconButton
          size="small"
          component={RouterLink}
          to={steamloomPath(`my/project/${projectId}/lore/${lore.public_id}`)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="刪除設定集">
        <IconButton
          size="small"
          color="error"
          onClick={() => setDeleteLoreTarget(lore)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderAssetActions = (asset: StorytellerAsset) => (
    <Stack direction="row" spacing={0.25}>
      <Tooltip title="移動資產">
        <IconButton
          size="small"
          onClick={(event) =>
            setAssetMoveMenu({ anchorEl: event.currentTarget, asset })
          }
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="編輯資產資訊">
        <IconButton
          size="small"
          onClick={() => {
            setEditingAsset(asset);
            setAssetForm(assetEditForm(asset));
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="刪除資產">
        <IconButton
          size="small"
          color="error"
          onClick={() => setDeleteAssetTarget(asset)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
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
          to={steamloomPath(`my/project/${projectId}/story/new`)}
          onClick={() => setCreateMenuAnchor(null)}
        >
          <ListItemIcon>
            <ArticleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>故事</ListItemText>
        </MenuItem>
        <MenuItem
          component={RouterLink}
          to={steamloomPath(`my/project/${projectId}/image/new`)}
          onClick={() => setCreateMenuAnchor(null)}
        >
          <ListItemIcon>
            <CollectionsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>圖像</ListItemText>
        </MenuItem>
      </Menu>
      <MoveMenu
        anchorEl={storyMoveMenu?.anchorEl ?? null}
        open={Boolean(storyMoveMenu)}
        disabled={saveStory.isPending}
        currentId={storyMoveMenu?.story.parent_id ?? null}
        rows={volumes.map((volume) => ({
          id: volume.id,
          publicId: volume.public_id,
          name: volume.title,
        }))}
        ungroupedLabel="移到未分冊"
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
        ungroupedLabel="移到未分類"
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
        ungroupedLabel="移到未分類"
        onClose={() => setAssetMoveMenu(null)}
        onMove={(collectionId) =>
          assetMoveMenu && void moveAssetTo(assetMoveMenu.asset, collectionId)
        }
      />
      {uploadPhase === "uploading" && (
        <UploadProgressToast rows={progressRows} />
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
              },
            },
          )
        }
      />
      <CollectionDialog
        open={Boolean(loreCollectionTarget || assetCollectionTarget)}
        title={loreCollectionTarget ? "設定集分類" : "資產集"}
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
      {editingAsset && assetForm && (
        <AssetEditDialog
          open
          form={assetForm}
          loading={updateAsset.isPending}
          onChange={setAssetForm}
          onClose={() => setEditingAsset(null)}
          onSubmit={async () => {
            try {
              await updateAsset.mutateAsync({
                assetPublicId: editingAsset.public_id,
                input: assetForm,
              });
              setEditingAsset(null);
              setSnack("資產資訊已更新。");
            } catch (error) {
              setSnack(errorMessage(error, "資產資訊更新失敗。"));
            }
          }}
        />
      )}
      {deleteStoryTarget && (
        <WorkspaceConfirmNameDialog
          open
          title={
            deleteStoryTarget.content_type === "image" ? "刪除話" : "刪除故事"
          }
          description="刪除後會移除作品與版本資料。請輸入作品名稱確認。"
          confirmName={deleteStoryTarget.title}
          confirmLabel="刪除作品"
          loading={deleteStory.isPending}
          onClose={() => setDeleteStoryTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteStoryTarget.public_id, {
              onSuccess: () => setDeleteStoryTarget(null),
              onError: (error) =>
                setSnack(errorMessage(error, "作品刪除失敗。")),
            })
          }
        />
      )}
      {deleteVolumeTarget && (
        <WorkspaceConfirmNameDialog
          open
          title="刪除冊"
          description="刪除後無法復原。請輸入冊名稱確認。"
          confirmName={deleteVolumeTarget.title}
          confirmLabel="刪除冊"
          loading={deleteStory.isPending}
          onClose={() => setDeleteVolumeTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteVolumeTarget.public_id, {
              onSuccess: () => {
                if (selected.collectionId === deleteVolumeTarget.public_id) {
                  onSelect("stories", "");
                }
                setDeleteVolumeTarget(null);
                setSnack("冊已刪除。");
              },
              onError: (error) => setSnack(errorMessage(error, "冊刪除失敗。")),
            })
          }
        />
      )}
      {deleteLoreTarget && (
        <WorkspaceConfirmNameDialog
          open
          title="刪除設定集"
          description="刪除後會移除這份設定集與版本資料。請輸入設定集名稱確認。"
          confirmName={deleteLoreTarget.title}
          confirmLabel="刪除設定集"
          loading={deleteLore.isPending}
          onClose={() => setDeleteLoreTarget(null)}
          onConfirm={() =>
            deleteLore.mutate(deleteLoreTarget.public_id, {
              onSuccess: () => setDeleteLoreTarget(null),
              onError: (error) =>
                setSnack(errorMessage(error, "設定集刪除失敗。")),
            })
          }
        />
      )}
      {deleteAssetTarget && (
        <WorkspaceConfirmNameDialog
          open
          title="刪除資產"
          description="刪除後無法復原。請輸入資產名稱確認。"
          confirmName={storytellerAssetTitle(deleteAssetTarget)}
          confirmLabel="刪除資產"
          loading={deleteAsset.isPending}
          onClose={() => setDeleteAssetTarget(null)}
          onConfirm={() =>
            deleteAsset.mutate(deleteAssetTarget.public_id, {
              onSuccess: () => setDeleteAssetTarget(null),
              onError: (error) =>
                setSnack(errorMessage(error, "資產刪除失敗。")),
            })
          }
        />
      )}
      {deleteLoreCollectionTarget && (
        <WorkspaceConfirmNameDialog
          open
          title="刪除分類"
          description="刪除後不會影響其他分類。請輸入分類名稱確認。"
          confirmName={deleteLoreCollectionTarget.name}
          confirmLabel="刪除分類"
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
                setSnack("分類已刪除。");
              },
              onError: (error) =>
                setSnack(errorMessage(error, "分類刪除失敗。")),
            })
          }
        />
      )}
      {deleteAssetCollectionTarget && (
        <WorkspaceConfirmNameDialog
          open
          title="刪除資產集"
          description="刪除後不會影響其他資產集。請輸入資產集名稱確認。"
          confirmName={deleteAssetCollectionTarget.name}
          confirmLabel="刪除資產集"
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
                  setSnack("資產集已刪除。");
                },
                onError: (error) =>
                  setSnack(errorMessage(error, "資產集刪除失敗。")),
              },
            )
          }
        />
      )}
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity="info"
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
  };
}
