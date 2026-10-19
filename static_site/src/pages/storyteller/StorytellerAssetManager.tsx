import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  useConfirmStorytellerAssetReplace,
  useDeleteStorytellerAssetCollection,
  useDeleteStorytellerAsset,
  useMoveStorytellerAsset,
  usePrepareStorytellerAssetReplace,
  useSaveStorytellerAssetCollection,
  useStorytellerAssetCollections,
  useStorytellerAssets,
  useUpdateStorytellerAsset,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
} from "@/data/storyteller.ts";
import { StorytellerAssetUploadDrawer } from "@/pages/storyteller/StorytellerAssetUploadDrawer.tsx";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
  StorytellerAssetCollectionRequest,
  StorytellerAssetUpdateRequest,
} from "@/types/storyteller.ts";

const assetPageSize = 24;
const uncategorizedCollectionId = "__uncategorized__";

interface UploadProgress {
  name: string;
  loaded: number;
  total: number;
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    return message || fallback;
  }
  return fallback;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function imageSizeLabel(asset: StorytellerAsset, unknownLabel: string) {
  const width = Number(asset.metadata?.width ?? 0);
  const height = Number(asset.metadata?.height ?? 0);
  return width > 0 && height > 0 ? `${width} × ${height}` : unknownLabel;
}

function editForm(asset: StorytellerAsset): StorytellerAssetUpdateRequest {
  return {
    title: asset.title,
    alt_text: asset.alt_text,
    description: asset.description,
    metadata: asset.metadata ?? {},
  };
}

function collectionForm(
  collection?: StorytellerAssetCollection,
): StorytellerAssetCollectionRequest {
  return {
    name: collection?.name ?? "",
    description: collection?.description ?? "",
    sort: collection?.sort ?? 0,
  };
}

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

export function StorytellerAssetManager({
  projectPublicId,
}: {
  projectPublicId: string;
}) {
  const { t, i18n } = useTranslation();
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error" | "info";
  } | null>(null);
  const [editingAsset, setEditingAsset] = useState<StorytellerAsset | null>(
    null,
  );
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [form, setForm] = useState<StorytellerAssetUpdateRequest>({
    title: "",
    alt_text: "",
    description: "",
    metadata: {},
  });
  const [editingCollection, setEditingCollection] =
    useState<StorytellerAssetCollection | null>(null);
  const [collectionFormData, setCollectionFormData] =
    useState<StorytellerAssetCollectionRequest>(collectionForm());
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionDeleteTarget, setCollectionDeleteTarget] =
    useState<StorytellerAssetCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorytellerAsset | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");
  const [draggingAsset, setDraggingAsset] = useState<StorytellerAsset | null>(
    null,
  );
  const [assetMoveMenu, setAssetMoveMenu] = useState<{
    anchorEl: HTMLElement;
    asset: StorytellerAsset;
  } | null>(null);
  const [replacePickerTarget, setReplacePickerTarget] =
    useState<StorytellerAsset | null>(null);
  const [replaceConfirmTarget, setReplaceConfirmTarget] = useState<{
    asset: StorytellerAsset;
    filename: string;
    pendingKey: string;
    mimeType: string;
  } | null>(null);
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading">("idle");
  const [uploadProgress, setUploadProgress] = useState<
    Record<number, UploadProgress>
  >({});
  const assetsQuery = useStorytellerAssets(
    projectPublicId,
    page,
    assetPageSize,
    keyword,
    activeCollectionId,
  );
  const collectionsQuery = useStorytellerAssetCollections(projectPublicId);
  const prepareAssetReplace =
    usePrepareStorytellerAssetReplace(projectPublicId);
  const confirmAssetReplace =
    useConfirmStorytellerAssetReplace(projectPublicId);
  const updateAsset = useUpdateStorytellerAsset(projectPublicId);
  const deleteAsset = useDeleteStorytellerAsset(projectPublicId);
  const saveCollection = useSaveStorytellerAssetCollection(projectPublicId);
  const deleteCollection = useDeleteStorytellerAssetCollection(projectPublicId);
  const moveAsset = useMoveStorytellerAsset(projectPublicId);
  const assets = assetsQuery.data?.assets ?? [];
  const collections = collectionsQuery.data ?? [];
  const totalPages = Math.ceil(
    (assetsQuery.data?.total_count ?? 0) / assetPageSize,
  );

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (
      activeCollectionId &&
      activeCollectionId !== uncategorizedCollectionId &&
      !collections.some(
        (collection) => collection.public_id === activeCollectionId,
      )
    ) {
      setActiveCollectionId("");
      setPage(1);
    }
  }, [activeCollectionId, collections]);

  // 上傳中關閉或重新整理頁面容易留下已 PUT 但尚未 confirm 的孤兒檔案；
  // 比照圖像作品頁，至少攔瀏覽器層級離開，提醒使用者等進度跑完。
  useEffect(() => {
    if (uploadPhase !== "uploading") {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadPhase]);

  function openEdit(asset: StorytellerAsset) {
    setEditingAsset(asset);
    setForm(editForm(asset));
  }

  function openCreateCollection() {
    setEditingCollection(null);
    setCollectionFormData({
      name: "",
      description: "",
      sort: collections.length * 10,
    });
    setCollectionDialogOpen(true);
  }

  function openEditCollection(collection: StorytellerAssetCollection) {
    setEditingCollection(collection);
    setCollectionFormData(collectionForm(collection));
    setCollectionDialogOpen(true);
  }

  async function saveAssetCollection() {
    try {
      const saved = await saveCollection.mutateAsync({
        collectionPublicId: editingCollection?.public_id,
        input: collectionFormData,
      });
      if (!editingCollection && saved?.public_id) {
        setActiveCollectionId(saved.public_id);
        setPage(1);
      }
      setSnack({
        message: editingCollection
          ? t("web.assetManager.messages.collectionUpdated")
          : t("web.assetManager.messages.collectionCreated"),
        severity: "success",
      });
      setCollectionDialogOpen(false);
      setEditingCollection(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, t("web.assetManager.errors.collectionSave")),
        severity: "error",
      });
    }
  }

  async function confirmDeleteCollection() {
    if (!collectionDeleteTarget) {
      return;
    }
    try {
      await deleteCollection.mutateAsync(collectionDeleteTarget.public_id);
      if (activeCollectionId === collectionDeleteTarget.public_id) {
        setActiveCollectionId("");
        setPage(1);
      }
      setSnack({
        message: t("web.assetManager.messages.collectionDeleted"),
        severity: "success",
      });
      setCollectionDeleteTarget(null);
    } catch (error) {
      setSnack({
        message: errorMessage(
          error,
          t("web.assetManager.errors.collectionDelete"),
        ),
        severity: "error",
      });
    }
  }

  async function moveAssetTo(
    asset: StorytellerAsset,
    collectionId: string,
    quietSuccess = false,
  ) {
    if ((asset.collection_id ?? "") === collectionId) {
      setAssetMoveMenu(null);
      return;
    }
    try {
      await moveAsset.mutateAsync({
        assetPublicId: asset.public_id,
        collectionId,
      });
      setAssetMoveMenu(null);
      if (!quietSuccess)
        setSnack({
          message: t("web.assetManager.messages.assetMoved"),
          severity: "success",
        });
    } catch (error) {
      setSnack({
        message: errorMessage(error, t("web.assetManager.errors.assetMove")),
        severity: "error",
      });
    }
  }

  function canDropDraggingAsset(collectionId: string) {
    return Boolean(
      draggingAsset && (draggingAsset.collection_id ?? "") !== collectionId,
    );
  }

  function handleAssetDragStart(
    event: DragEvent<HTMLElement>,
    asset: StorytellerAsset,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", asset.public_id);
    setDraggingAsset(asset);
  }

  function handleCollectionDragOver(
    event: DragEvent<HTMLElement>,
    collectionId: string,
  ) {
    if (!canDropDraggingAsset(collectionId)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleCollectionDrop(
    event: DragEvent<HTMLElement>,
    collectionId: string,
  ) {
    event.preventDefault();
    if (draggingAsset) {
      // 拖曳已有即時列表變化，僅在持久化失敗時提示。
      void moveAssetTo(draggingAsset, collectionId, true);
    }
    setDraggingAsset(null);
  }

  function chooseAssetReplace(asset: StorytellerAsset) {
    if (asset.asset_type !== "image") {
      setSnack({
        message: t("web.assetManager.errors.replaceImageOnly"),
        severity: "error",
      });
      return;
    }
    setAssetMoveMenu(null);
    setReplacePickerTarget(asset);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = "";
    }
    window.setTimeout(() => replaceFileInputRef.current?.click(), 0);
  }

  async function handleReplaceFile(files: FileList | null) {
    const target = replacePickerTarget;
    const file = files?.[0];
    if (!target || !file) {
      return;
    }
    if (!STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
      setSnack({
        message: t("web.assetManager.errors.invalidImageType"),
        severity: "error",
      });
      setReplacePickerTarget(null);
      return;
    }
    if (file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES) {
      const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);
      setSnack({
        message: t("web.assetManager.errors.fileTooLarge", { maxMB }),
        severity: "error",
      });
      setReplacePickerTarget(null);
      return;
    }
    setUploadPhase("uploading");
    setUploadProgress({ 0: { name: file.name, loaded: 0, total: file.size } });
    try {
      const upload = await prepareAssetReplace.mutateAsync({
        assetPublicId: target.public_id,
        file,
        onProgress: (loaded, total) =>
          setUploadProgress({ 0: { name: file.name, loaded, total } }),
      });
      setReplaceConfirmTarget({
        asset: target,
        filename: file.name,
        pendingKey: upload.pending_key,
        mimeType: file.type,
      });
      setSnack({
        message: t("web.assetManager.messages.replaceUploaded"),
        severity: "info",
      });
    } catch (error) {
      setSnack({
        message: errorMessage(
          error,
          t("web.assetManager.errors.replaceUpload"),
        ),
        severity: "error",
      });
    } finally {
      setUploadPhase("idle");
      setReplacePickerTarget(null);
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = "";
      }
    }
  }

  async function saveEdit() {
    if (!editingAsset) {
      return;
    }
    try {
      await updateAsset.mutateAsync({
        assetPublicId: editingAsset.public_id,
        input: form,
      });
      setSnack({
        message: t("web.assetManager.messages.assetUpdated"),
        severity: "success",
      });
      setEditingAsset(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, t("web.assetManager.errors.assetUpdate")),
        severity: "error",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteAsset.mutateAsync(deleteTarget.public_id);
      setSnack({
        message: t("web.assetManager.messages.assetDeleted"),
        severity: "success",
      });
      setDeleteTarget(null);
    } catch (error) {
      const message = errorMessage(error, t("web.assetManager.errors.assetDelete"));
      setDeleteError(message);
      setSnack({
        message,
        severity: "error",
      });
    }
  }

  async function confirmReplaceFile() {
    if (!replaceConfirmTarget) {
      return;
    }
    try {
      await confirmAssetReplace.mutateAsync({
        assetPublicId: replaceConfirmTarget.asset.public_id,
        pendingKey: replaceConfirmTarget.pendingKey,
      });
      await assetsQuery.refetch();
      setReplaceConfirmTarget(null);
      setSnack({
        message: t("web.assetManager.messages.fileReplaced"),
        severity: "success",
      });
    } catch (error) {
      setSnack({
        message: errorMessage(error, t("web.assetManager.errors.fileReplace")),
        severity: "error",
      });
    }
  }

  const progressRows = Object.values(uploadProgress);
  const progressLoaded = progressRows.reduce((sum, row) => sum + row.loaded, 0);
  const progressTotal = progressRows.reduce((sum, row) => sum + row.total, 0);
  const overallProgress =
    progressTotal > 0 ? Math.round((progressLoaded / progressTotal) * 100) : 0;
  const openUploadMenu = (target: HTMLElement) => setUploadMenuAnchor(target);
  const chooseImageUpload = () => {
    setUploadMenuAnchor(null);
    setUploadDrawerOpen(true);
  };
  const assetCollectionName = (asset: StorytellerAsset) =>
    asset.collection_id
      ? (collections.find(
          (collection) => collection.public_id === asset.collection_id,
        )?.name ?? t("web.assetManager.collection.fallback"))
      : t("web.assetManager.uncategorized");

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Typography variant="h6" fontWeight={800}>
          {t("web.assetManager.title")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label={t("web.assetManager.search")}
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void assetsQuery.refetch()}
          >
            {t("web.assetManager.refresh")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            onClick={openCreateCollection}
          >
            {t("web.assetManager.collection.create")}
          </Button>
          <ButtonGroup
            variant="contained"
            sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
          >
            <Button
              startIcon={<FileUploadIcon />}
              disabled={uploadPhase === "uploading"}
              onClick={(event) => openUploadMenu(event.currentTarget)}
              sx={{ flex: { xs: 1, sm: "initial" } }}
            >
              {uploadPhase === "uploading"
                ? t("web.assetManager.uploading")
                : t("web.common.upload")}
            </Button>
            <Button
              size="small"
              disabled={uploadPhase === "uploading"}
              onClick={(event) => openUploadMenu(event.currentTarget)}
              sx={{ px: 0.5 }}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={uploadMenuAnchor}
            open={Boolean(uploadMenuAnchor)}
            onClose={() => setUploadMenuAnchor(null)}
          >
            <MenuItem onClick={chooseImageUpload}>
              <ListItemIcon>
                <ImageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("web.assetManager.image")}</ListItemText>
            </MenuItem>
          </Menu>
          <Box
            component="input"
            ref={replaceFileInputRef}
            type="file"
            accept={STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.join(",")}
            sx={{ display: "none" }}
            onChange={(event) => void handleReplaceFile(event.target.files)}
          />
        </Stack>
      </Stack>

      <Menu
        anchorEl={assetMoveMenu?.anchorEl ?? null}
        open={Boolean(assetMoveMenu)}
        onClose={() => setAssetMoveMenu(null)}
      >
        <MenuItem
          disabled={
            uploadPhase === "uploading" ||
            confirmAssetReplace.isPending ||
            assetMoveMenu?.asset.asset_type !== "image"
          }
          onClick={() =>
            assetMoveMenu && chooseAssetReplace(assetMoveMenu.asset)
          }
        >
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("web.assetManager.replaceFile")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          disabled={
            moveAsset.isPending ||
            (assetMoveMenu?.asset.collection_id ?? "") === ""
          }
          onClick={() =>
            assetMoveMenu && void moveAssetTo(assetMoveMenu.asset, "")
          }
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("web.assetManager.moveUncategorized")}</ListItemText>
        </MenuItem>
        {collections.map((collection) => (
          <MenuItem
            key={collection.public_id}
            disabled={
              moveAsset.isPending ||
              assetMoveMenu?.asset.collection_id === collection.public_id
            }
            onClick={() =>
              assetMoveMenu &&
              void moveAssetTo(assetMoveMenu.asset, collection.public_id)
            }
          >
            <ListItemIcon>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={collection.name}
              secondary={collection.description || undefined}
            />
          </MenuItem>
        ))}
      </Menu>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant={activeCollectionId === "" ? "contained" : "outlined"}
          startIcon={<FolderIcon />}
          onClick={() => {
            setActiveCollectionId("");
            setPage(1);
          }}
        >
          {t("web.common.all")}
        </Button>
        <Tooltip title={t("web.assetManager.uncategorizedDropHint")}>
          <Button
            size="small"
            variant={
              activeCollectionId === uncategorizedCollectionId
                ? "contained"
                : "outlined"
            }
            startIcon={<DragIndicatorIcon />}
            onDragOver={(event) => handleCollectionDragOver(event, "")}
            onDrop={(event) => handleCollectionDrop(event, "")}
            onClick={() => {
              setActiveCollectionId(uncategorizedCollectionId);
              setPage(1);
            }}
            sx={dropTargetSx(canDropDraggingAsset(""))}
          >
            {t("web.assetManager.uncategorized")}
          </Button>
        </Tooltip>
        {collections.map((collection) => (
          <ButtonGroup
            key={collection.public_id}
            size="small"
            onDragOver={(event) =>
              handleCollectionDragOver(event, collection.public_id)
            }
            onDrop={(event) =>
              handleCollectionDrop(event, collection.public_id)
            }
            variant={
              activeCollectionId === collection.public_id
                ? "contained"
                : "outlined"
            }
            sx={dropTargetSx(canDropDraggingAsset(collection.public_id))}
          >
            <Tooltip
              title={
                collection.description
                  ? t("web.assetManager.collection.dropHintWithDescription", {
                      name: collection.name,
                      description: collection.description,
                    })
                  : t("web.assetManager.collection.dropHint", {
                      name: collection.name,
                    })
              }
            >
              <Button
                onClick={() => {
                  setActiveCollectionId(collection.public_id);
                  setPage(1);
                }}
                sx={{ maxWidth: 220 }}
              >
                <DragIndicatorIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Box
                  component="span"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {collection.name}
                </Box>
                <Box component="span" sx={{ ml: 0.75, opacity: 0.72 }}>
                  {collection.asset_count}
                </Box>
              </Button>
            </Tooltip>
            <Tooltip title={t("web.assetManager.collection.edit")}>
              <Button onClick={() => openEditCollection(collection)}>
                <EditIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip
              title={
                collection.asset_count > 0
                  ? t("web.assetManager.collection.deleteBlocked")
                  : t("web.assetManager.collection.delete")
              }
            >
              <Button
                color="error"
                disabled={collection.asset_count > 0}
                onClick={() => setCollectionDeleteTarget(collection)}
              >
                <DeleteIcon fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        ))}
      </Stack>

      {uploadPhase === "uploading" && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography fontWeight={800}>
                {t("web.assetManager.imageUploading")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {overallProgress}%
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={overallProgress} />
            <Stack spacing={1}>
              {progressRows.map((row, index) => {
                const percent =
                  row.total > 0
                    ? Math.min(100, Math.round((row.loaded / row.total) * 100))
                    : 0;
                return (
                  <Stack key={`${index}-${row.name}`} spacing={0.5}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          overflowWrap: "anywhere",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 1,
                          overflow: "hidden",
                        }}
                      >
                        {row.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {percent}%
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={percent} />
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      )}

      {assetsQuery.isLoading ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 1 }}>
          <Typography color="text.secondary">
            {t("web.assetManager.loading")}
          </Typography>
        </Paper>
      ) : assets.length === 0 ? (
        <CustomEmptyState
          icon={<ImageIcon />}
          title={t("web.assetManager.emptyTitle")}
          description={t("web.assetManager.emptyDescription")}
        />
      ) : (
        <Grid container spacing={2}>
          {assets.map((asset) => (
            <Grid key={asset.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Tooltip
                title={t("web.assetManager.dragHint")}
                enterDelay={450}
                disableInteractive
              >
                <Paper
                  variant="outlined"
                  draggable
                  onDragStart={(event) => handleAssetDragStart(event, asset)}
                  onDragEnd={() => setDraggingAsset(null)}
                  sx={{
                    borderRadius: 1,
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "grab",
                    opacity:
                      draggingAsset?.public_id === asset.public_id ? 0.55 : 1,
                  }}
                >
                  <Box
                    component="img"
                    src={asset.preview_url}
                    alt={
                      asset.alt_text || asset.title || asset.original_filename
                    }
                    sx={{
                      width: "100%",
                      aspectRatio: "16 / 10",
                      objectFit: "cover",
                      bgcolor: "background.default",
                    }}
                  />
                  <Stack spacing={1.25} sx={{ p: 1.5, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                      justifyContent="space-between"
                    >
                      <Stack sx={{ minWidth: 0 }}>
                        <Typography
                          fontWeight={800}
                          sx={{
                            overflowWrap: "anywhere",
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                          }}
                        >
                          {asset.title ||
                            asset.original_filename ||
                            t("web.assetManager.untitled")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatStorytellerDate(
                            asset.created_at,
                            i18n.resolvedLanguage,
                          )}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={t("web.assetManager.editAsset")}>
                          <IconButton
                            size="small"
                            onClick={() => openEdit(asset)}
                          >
                            <EditIcon fontSize="small" />
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
                              color="error"
                              disabled={asset.reference_count > 0}
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(asset);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t("web.assetManager.actions")}>
                          <IconButton
                            size="small"
                            onClick={(event) =>
                              setAssetMoveMenu({
                                anchorEl: event.currentTarget,
                                asset,
                              })
                            }
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        size="small"
                        icon={<FolderIcon />}
                        label={assetCollectionName(asset)}
                      />
                      <Chip size="small" label={asset.mime_type} />
                      <Chip
                        size="small"
                        label={formatFileSize(asset.file_size)}
                      />
                      <Chip
                        size="small"
                        label={imageSizeLabel(
                          asset,
                          t("web.assetManager.unknownDimensions"),
                        )}
                      />
                      {asset.reference_count > 0 && (
                        <Chip
                          size="small"
                          color="warning"
                          label={t("web.assetManager.references", {
                            count: asset.reference_count,
                          })}
                        />
                      )}
                    </Stack>
                    {asset.description.trim() && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflowWrap: "anywhere",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        }}
                      >
                        {asset.description}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
          />
        </Stack>
      )}

      <Dialog
        open={Boolean(editingAsset)}
        onClose={() => setEditingAsset(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("web.assetManager.editAsset")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t("web.assetManager.fields.title")}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <TextField
              label={t("web.assetManager.fields.altText")}
              value={form.alt_text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  alt_text: event.target.value,
                }))
              }
            />
            <TextField
              label={t("web.assetManager.fields.notes")}
              value={form.description}
              multiline
              minRows={3}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingAsset(null)}>
            {t("web.common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={updateAsset.isPending}
            onClick={() => void saveEdit()}
          >
            {updateAsset.isPending
              ? t("web.assetManager.saving")
              : t("web.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <StorytellerAssetUploadDrawer
        open={uploadDrawerOpen}
        projectPublicId={projectPublicId}
        collectionId={
          activeCollectionId === uncategorizedCollectionId
            ? ""
            : activeCollectionId
        }
        onClose={() => setUploadDrawerOpen(false)}
        onUploaded={() => setPage(1)}
        onNotify={(message, severity) => setSnack({ message, severity })}
      />

      <Dialog
        open={collectionDialogOpen}
        onClose={() => {
          setCollectionDialogOpen(false);
          setEditingCollection(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editingCollection
            ? t("web.assetManager.collection.edit")
            : t("web.assetManager.collection.create")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t("web.assetManager.collection.name")}
              value={collectionFormData.name}
              onChange={(event) =>
                setCollectionFormData((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <TextField
              label={t("web.assetManager.collection.description")}
              value={collectionFormData.description}
              multiline
              minRows={3}
              onChange={(event) =>
                setCollectionFormData((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            <TextField
              label={t("web.assetManager.collection.sort")}
              type="number"
              value={collectionFormData.sort}
              onChange={(event) =>
                setCollectionFormData((current) => ({
                  ...current,
                  sort: Number(event.target.value),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCollectionDialogOpen(false);
              setEditingCollection(null);
            }}
          >
            {t("web.common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={saveCollection.isPending}
            onClick={() => void saveAssetCollection()}
          >
            {saveCollection.isPending
              ? t("web.assetManager.saving")
              : t("web.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <StorytellerConfirmNameDialog
        open={Boolean(deleteTarget)}
        title={t("web.assetManager.deleteAsset")}
        description={t("web.assetManager.deleteAssetDescription")}
        confirmName={
          deleteTarget?.title ||
          deleteTarget?.original_filename ||
          deleteTarget?.public_id ||
          ""
        }
        confirmLabel={t("web.common.delete")}
        loading={deleteAsset.isPending}
        error={deleteError}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={() => void confirmDelete()}
      />

      <StorytellerConfirmNameDialog
        open={Boolean(collectionDeleteTarget)}
        title={t("web.assetManager.collection.delete")}
        description={t("web.assetManager.collection.deleteDescription")}
        confirmName={collectionDeleteTarget?.name ?? ""}
        confirmLabel={t("web.common.delete")}
        loading={deleteCollection.isPending}
        onClose={() => setCollectionDeleteTarget(null)}
        onConfirm={() => void confirmDeleteCollection()}
      />

      <StorytellerMascotDialog
        open={Boolean(replaceConfirmTarget)}
        state="danger"
        toneLabel={t("web.assetManager.replace.tone")}
        eyebrow={t("web.assetManager.replace.eyebrow")}
        title={t("web.assetManager.replace.title")}
        description={t("web.assetManager.replace.description")}
        onClose={() => setReplaceConfirmTarget(null)}
        actions={
          <>
            <Button onClick={() => setReplaceConfirmTarget(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={confirmAssetReplace.isPending}
              onClick={() => void confirmReplaceFile()}
            >
              {confirmAssetReplace.isPending
                ? t("web.assetManager.replace.replacing")
                : t("web.assetManager.replace.confirm")}
            </Button>
          </>
        }
      >
        <Typography variant="body2" color="text.secondary">
          {replaceConfirmTarget?.asset.title ||
            replaceConfirmTarget?.asset.original_filename ||
            replaceConfirmTarget?.asset.public_id}
          {" → "}
          {replaceConfirmTarget?.filename}（{replaceConfirmTarget?.mimeType}）
        </Typography>
      </StorytellerMascotDialog>

      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </Stack>
  );
}
