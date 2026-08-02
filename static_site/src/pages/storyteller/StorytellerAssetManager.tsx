import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
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
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  useDeleteStorytellerAssetCollection,
  useDeleteStorytellerAsset,
  useMoveStorytellerAsset,
  useSaveStorytellerAssetCollection,
  useStorytellerAssetCollections,
  useStorytellerAssets,
  useUpdateStorytellerAsset,
  useUploadStorytellerAssets,
} from "@/apis/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
  STORYTELLER_IMAGE_PAGE_MAX_COUNT,
} from "@/data/storyteller.ts";
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

function imageSizeLabel(asset: StorytellerAsset) {
  const width = Number(asset.metadata?.width ?? 0);
  const height = Number(asset.metadata?.height ?? 0);
  return width > 0 && height > 0 ? `${width} × ${height}` : "尺寸未記錄";
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
    sort: collection?.sort ?? 0,
  };
}

export function StorytellerAssetManager({
  projectPublicId,
}: {
  projectPublicId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
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
  const uploadAssets = useUploadStorytellerAssets(projectPublicId);
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
    setCollectionFormData({ name: "", sort: collections.length * 10 });
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
        message: editingCollection ? "資產集已更新。" : "資產集已建立。",
        severity: "success",
      });
      setCollectionDialogOpen(false);
      setEditingCollection(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產集儲存失敗。"),
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
      setSnack({ message: "資產集已刪除。", severity: "success" });
      setCollectionDeleteTarget(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產集刪除失敗。"),
        severity: "error",
      });
    }
  }

  async function moveAssetTo(asset: StorytellerAsset, collectionId: string) {
    if ((asset.collection_id ?? "") === collectionId) {
      return;
    }
    try {
      await moveAsset.mutateAsync({
        assetPublicId: asset.public_id,
        collectionId,
      });
      setSnack({ message: "資產已移動。", severity: "success" });
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產移動失敗。"),
        severity: "error",
      });
    }
  }

  async function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const rejectedType = selected.some(
      (file) => !STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type),
    );
    const rejectedSize = selected.some(
      (file) => file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const accepted = selected.filter(
      (file) =>
        STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type) &&
        file.size <= STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const images = accepted.slice(0, STORYTELLER_IMAGE_PAGE_MAX_COUNT);
    const overCount = accepted.length > STORYTELLER_IMAGE_PAGE_MAX_COUNT;
    if (images.length === 0) {
      setSnack({ message: "請選擇圖片檔案。", severity: "error" });
      return;
    }
    if (rejectedType || rejectedSize || overCount) {
      const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);
      const reasons = [
        rejectedType && "只接受 JPEG／PNG／WebP／GIF 圖片檔",
        rejectedSize && `單張檔案不能超過 ${maxMB}MB`,
        overCount && `單次最多 ${STORYTELLER_IMAGE_PAGE_MAX_COUNT} 張`,
      ].filter(Boolean);
      setSnack({
        message: `部分檔案未上傳：${reasons.join("、")}`,
        severity: "error",
      });
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
          activeCollectionId === uncategorizedCollectionId
            ? ""
            : activeCollectionId,
        onProgress: (index, loaded, total) => {
          setUploadProgress((current) => ({
            ...current,
            [index]: {
              name: current[index]?.name ?? images[index]?.name ?? "",
              loaded,
              total,
            },
          }));
        },
      });
      setSnack({
        message: `已上傳 ${uploaded.length} 個資產。`,
        severity: "success",
      });
      setPage(1);
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產上傳失敗，請稍後再試。"),
        severity: "error",
      });
    } finally {
      setUploadPhase("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
      setSnack({ message: "資產資訊已更新。", severity: "success" });
      setEditingAsset(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產資訊更新失敗。"),
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
      setSnack({ message: "資產已刪除。", severity: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setSnack({
        message: errorMessage(error, "資產刪除失敗。"),
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
    fileInputRef.current?.click();
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Typography variant="h6" fontWeight={800}>
          資產集
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label="搜尋資產"
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
            重新整理
          </Button>
          <Button
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            onClick={openCreateCollection}
          >
            建立資產集
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
              {uploadPhase === "uploading" ? "上傳中" : "上傳"}
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
              <ListItemText>圖像</ListItemText>
            </MenuItem>
          </Menu>
          <Box
            component="input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            sx={{ display: "none" }}
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </Stack>
      </Stack>

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
          全部
        </Button>
        <Button
          size="small"
          variant={
            activeCollectionId === uncategorizedCollectionId
              ? "contained"
              : "outlined"
          }
          onClick={() => {
            setActiveCollectionId(uncategorizedCollectionId);
            setPage(1);
          }}
        >
          未分類
        </Button>
        {collections.map((collection) => (
          <ButtonGroup
            key={collection.public_id}
            size="small"
            variant={
              activeCollectionId === collection.public_id
                ? "contained"
                : "outlined"
            }
          >
            <Button
              onClick={() => {
                setActiveCollectionId(collection.public_id);
                setPage(1);
              }}
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
                {collection.name}
              </Box>
              <Box component="span" sx={{ ml: 0.75, opacity: 0.72 }}>
                {collection.asset_count}
              </Box>
            </Button>
            <Tooltip title="編輯資產集">
              <Button onClick={() => openEditCollection(collection)}>
                <EditIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip
              title={
                collection.asset_count > 0
                  ? "資產集內仍有資產，不能刪除"
                  : "刪除資產集"
              }
            >
              <span>
                <Button
                  color="error"
                  disabled={collection.asset_count > 0}
                  onClick={() => setCollectionDeleteTarget(collection)}
                >
                  <DeleteIcon fontSize="small" />
                </Button>
              </span>
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
              <Typography fontWeight={800}>圖片上傳中</Typography>
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
          <Typography color="text.secondary">正在載入資產...</Typography>
        </Paper>
      ) : assets.length === 0 ? (
        <CustomEmptyState
          icon={<ImageIcon />}
          title="尚未有資產"
          description="上傳圖片後，會在這裡管理標題、替代文字與備註。"
        />
      ) : (
        <Grid container spacing={2}>
          {assets.map((asset) => (
            <Grid key={asset.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 1,
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  component="img"
                  src={asset.preview_url}
                  alt={asset.alt_text || asset.title || asset.original_filename}
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
                        {asset.title || asset.original_filename || "未命名資產"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatStorytellerDate(asset.created_at)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="編輯資產資訊">
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
                            ? "仍被作品引用，不能刪除"
                            : "刪除資產"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={asset.reference_count > 0}
                            onClick={() => setDeleteTarget(asset)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={asset.mime_type} />
                    <Chip
                      size="small"
                      label={formatFileSize(asset.file_size)}
                    />
                    <Chip size="small" label={imageSizeLabel(asset)} />
                    {asset.reference_count > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label={`引用 ${asset.reference_count}`}
                      />
                    )}
                  </Stack>
                  <TextField
                    select
                    size="small"
                    label="所屬資產集"
                    value={asset.collection_id ?? ""}
                    disabled={moveAsset.isPending}
                    onChange={(event) =>
                      void moveAssetTo(asset, event.target.value)
                    }
                  >
                    <MenuItem value="">未分類</MenuItem>
                    {collections.map((collection) => (
                      <MenuItem
                        key={collection.public_id}
                        value={collection.public_id}
                      >
                        {collection.name}
                      </MenuItem>
                    ))}
                  </TextField>
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
        <DialogTitle>編輯資產資訊</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="標題"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <TextField
              label="替代文字"
              value={form.alt_text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  alt_text: event.target.value,
                }))
              }
            />
            <TextField
              label="備註"
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
          <Button onClick={() => setEditingAsset(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={updateAsset.isPending}
            onClick={() => void saveEdit()}
          >
            {updateAsset.isPending ? "儲存中" : "儲存"}
          </Button>
        </DialogActions>
      </Dialog>

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
          {editingCollection ? "編輯資產集" : "建立資產集"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="名稱"
              value={collectionFormData.name}
              onChange={(event) =>
                setCollectionFormData((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <TextField
              label="排序"
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
            取消
          </Button>
          <Button
            variant="contained"
            disabled={saveCollection.isPending}
            onClick={() => void saveAssetCollection()}
          >
            {saveCollection.isPending ? "儲存中" : "儲存"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmNameDialog
        open={Boolean(deleteTarget)}
        title="刪除資產"
        description="刪除後這個資產會從資產集移除；已被引用的資產不能刪除。"
        confirmName={
          deleteTarget?.title ||
          deleteTarget?.original_filename ||
          deleteTarget?.public_id ||
          ""
        }
        confirmLabel="刪除"
        loading={deleteAsset.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmNameDialog
        open={Boolean(collectionDeleteTarget)}
        title="刪除資產集"
        description="刪除前請先把資產集內的資產移到其他資產集或未分類。"
        confirmName={collectionDeleteTarget?.name ?? ""}
        confirmLabel="刪除"
        loading={deleteCollection.isPending}
        onClose={() => setCollectionDeleteTarget(null)}
        onConfirm={() => void confirmDeleteCollection()}
      />

      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </Stack>
  );
}
