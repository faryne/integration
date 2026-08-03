import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { useEffect, useState, type DragEvent } from "react";
import {
  useDeleteStorytellerLore,
  useDeleteStorytellerLoreCollection,
  useMoveStorytellerLore,
  useSaveStorytellerLoreCollection,
  useStorytellerLoreCollections,
  useStorytellerLoresPage,
} from "@/apis/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type {
  StorytellerLore,
  StorytellerLoreCollection,
} from "@/types/storyteller.ts";

const loreCollectionUncategorized = "__uncategorized__";

type LoreCollectionDialogTarget = "new" | StorytellerLoreCollection | null;

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

function collectionDescription(collection: StorytellerLoreCollection) {
  return collection.description.trim()
    ? `可將設定集拖曳到「${collection.name}」。用途：${collection.description}`
    : `可將設定集拖曳到「${collection.name}」`;
}

export function StorytellerLoreManager({
  projectPublicId,
}: {
  projectPublicId: string;
}) {
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [loresPage, setLoresPage] = useState(1);
  const [draggingLore, setDraggingLore] = useState<StorytellerLore | null>(
    null,
  );
  const [collectionDialogTarget, setCollectionDialogTarget] =
    useState<LoreCollectionDialogTarget>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescriptionInput, setCollectionDescriptionInput] =
    useState("");
  const [deleteCollectionTarget, setDeleteCollectionTarget] =
    useState<StorytellerLoreCollection | null>(null);
  const [deleteLoreTarget, setDeleteLoreTarget] =
    useState<StorytellerLore | null>(null);
  const [moveMenu, setMoveMenu] = useState<{
    anchorEl: HTMLElement;
    lore: StorytellerLore;
  } | null>(null);
  const [snack, setSnack] = useState("");
  const loresPageSize = 20;

  const collectionsQuery = useStorytellerLoreCollections(projectPublicId);
  const collections = collectionsQuery.data ?? [];
  const loresQuery = useStorytellerLoresPage(
    projectPublicId,
    selectedCollectionId,
    loresPage,
    loresPageSize,
  );
  const lores = loresQuery.data?.lores ?? [];
  const loresTotalPages = Math.ceil(
    (loresQuery.data?.total_count ?? 0) / loresPageSize,
  );
  const saveCollection = useSaveStorytellerLoreCollection(projectPublicId);
  const deleteCollection = useDeleteStorytellerLoreCollection(projectPublicId);
  const moveLore = useMoveStorytellerLore(projectPublicId);
  const deleteLore = useDeleteStorytellerLore(projectPublicId);

  useEffect(() => {
    setLoresPage(1);
  }, [selectedCollectionId]);

  useEffect(() => {
    if (loresTotalPages > 0 && loresPage > loresTotalPages) {
      setLoresPage(loresTotalPages);
    }
  }, [loresPage, loresTotalPages]);

  function openCollectionDialog(target: LoreCollectionDialogTarget) {
    setCollectionDialogTarget(target);
    setCollectionName(target && target !== "new" ? target.name : "");
    setCollectionDescriptionInput(
      target && target !== "new" ? target.description : "",
    );
  }

  function canDropDraggingLore(collectionId: string) {
    return Boolean(
      draggingLore &&
        (draggingLore.collection_id ?? loreCollectionUncategorized) !==
          (collectionId || loreCollectionUncategorized),
    );
  }

  function handleLoreDragStart(
    event: DragEvent<HTMLElement>,
    lore: StorytellerLore,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lore.public_id);
    setDraggingLore(lore);
  }

  function handleCollectionDragOver(
    event: DragEvent<HTMLElement>,
    collectionId: string,
  ) {
    if (!canDropDraggingLore(collectionId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function moveLoreTo(lore: StorytellerLore, collectionId: string) {
    const targetCollectionId =
      collectionId === loreCollectionUncategorized ? "" : collectionId;
    moveLore.mutate(
      { lorePublicId: lore.public_id, collectionId: targetCollectionId },
      {
        onSuccess: () => {
          setSnack(
            targetCollectionId ? "設定集已移入分類。" : "設定集已移到未分類。",
          );
        },
        onError: (error) => setSnack(error.message),
      },
    );
  }

  function handleCollectionDrop(
    event: DragEvent<HTMLElement>,
    collectionId: string,
  ) {
    event.preventDefault();
    if (draggingLore) moveLoreTo(draggingLore, collectionId);
    setDraggingLore(null);
  }

  function submitCollection() {
    const name = collectionName.trim();
    if (!name) {
      setSnack("分類名稱不可空白。");
      return;
    }
    const input = {
      name,
      description: collectionDescriptionInput.trim(),
      sort:
        collectionDialogTarget && collectionDialogTarget !== "new"
          ? collectionDialogTarget.sort
          : collections.length + 1,
    };
    saveCollection.mutate(
      {
        collectionPublicId:
          collectionDialogTarget && collectionDialogTarget !== "new"
            ? collectionDialogTarget.public_id
            : undefined,
        input,
      },
      {
        onSuccess: () => {
          setCollectionDialogTarget(null);
          setSnack(
            collectionDialogTarget === "new" ? "分類已建立。" : "分類已更新。",
          );
        },
        onError: (error) => setSnack(error.message),
      },
    );
  }

  const loading = collectionsQuery.isLoading || loresQuery.isLoading;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Typography variant="h6" fontWeight={800}>
          設定集列表
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            startIcon={<CreateNewFolderIcon />}
            variant="outlined"
            onClick={() => openCollectionDialog("new")}
          >
            建立分類
          </Button>
          <Button
            href={steamloomPath(`my/project/${projectPublicId}/lore/new`)}
            variant="contained"
          >
            建立設定集
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Tooltip title="顯示全部設定集">
            <Button
              size="small"
              variant={selectedCollectionId === "" ? "contained" : "outlined"}
              startIcon={<FolderIcon />}
              onClick={() => setSelectedCollectionId("")}
            >
              全部
            </Button>
          </Tooltip>
          <Tooltip title="可將設定集拖曳到這裡，移到未分類">
            <Button
              size="small"
              variant={
                selectedCollectionId === loreCollectionUncategorized
                  ? "contained"
                  : "outlined"
              }
              startIcon={<DragIndicatorIcon />}
              onClick={() => setSelectedCollectionId(loreCollectionUncategorized)}
              onDragOver={(event) => handleCollectionDragOver(event, "")}
              onDrop={(event) => handleCollectionDrop(event, "")}
              sx={dropTargetSx(canDropDraggingLore(""))}
            >
              未分類
            </Button>
          </Tooltip>

          {collections.map((collection) => (
            <ButtonGroup
              key={collection.public_id}
              size="small"
              onDragOver={(event) =>
                handleCollectionDragOver(event, collection.public_id)
              }
              onDrop={(event) => handleCollectionDrop(event, collection.public_id)}
              variant={
                selectedCollectionId === collection.public_id
                  ? "contained"
                  : "outlined"
              }
              sx={dropTargetSx(canDropDraggingLore(collection.public_id))}
            >
              <Tooltip title={collectionDescription(collection)}>
                <Button
                  onClick={() => setSelectedCollectionId(collection.public_id)}
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
                    {collection.lore_count}
                  </Box>
                </Button>
              </Tooltip>
              <Tooltip title="編輯分類">
                <Button onClick={() => openCollectionDialog(collection)}>
                  <EditIcon fontSize="small" />
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  collection.lore_count > 0
                    ? "分類內仍有設定集，不能刪除"
                    : "刪除分類"
                }
              >
                <Button
                  color="error"
                  disabled={collection.lore_count > 0}
                  onClick={() => setDeleteCollectionTarget(collection)}
                >
                  <DeleteIcon fontSize="small" />
                </Button>
              </Tooltip>
            </ButtonGroup>
          ))}
        </Stack>
      </Stack>

      {loading ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 1 }}>
          <Typography color="text.secondary">正在載入設定集...</Typography>
        </Paper>
      ) : lores.length === 0 ? (
        <CustomEmptyState
          icon={<MenuBookIcon fontSize="large" />}
          title="尚未建立設定集"
          description="使用上方的「建立設定集」記錄世界觀、角色規則與劇本設定。"
        />
      ) : (
        <Stack spacing={1.5}>
          {lores.map((lore) => (
            <Tooltip
              key={lore.public_id}
              title="可拖曳到上方分類移動"
              enterDelay={450}
              disableInteractive
            >
              <Paper
                draggable
                variant="outlined"
                onDragStart={(event) => handleLoreDragStart(event, lore)}
                onDragEnd={() => setDraggingLore(null)}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  cursor: "grab",
                  opacity: draggingLore?.public_id === lore.public_id ? 0.55 : 1,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <MenuBookIcon color="primary" />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800}>{lore.title}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" color="text.secondary">
                        {lore.word_count.toLocaleString()} 字 ·{" "}
                        {formatStorytellerDate(lore.updated_at)}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<FolderIcon />}
                        label={
                          collections.find(
                            (collection) =>
                              collection.public_id === lore.collection_id,
                          )?.name ?? "未分類"
                        }
                      />
                    </Stack>
                  </Stack>
                  <Tooltip title="移動設定集">
                    <IconButton
                      size="small"
                      onClick={(event) =>
                        setMoveMenu({ anchorEl: event.currentTarget, lore })
                      }
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button
                    href={steamloomPath(
                      `my/project/${projectPublicId}/lore/${lore.public_id}`,
                    )}
                    variant="outlined"
                    size="small"
                  >
                    編輯
                  </Button>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteLoreTarget(lore)}
                  >
                    刪除
                  </Button>
                </Stack>
              </Paper>
            </Tooltip>
          ))}
          {loresTotalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Pagination
                count={loresTotalPages}
                page={loresPage}
                onChange={(_, value) => setLoresPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      )}

      <Dialog
        open={Boolean(collectionDialogTarget)}
        onClose={() => setCollectionDialogTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {collectionDialogTarget === "new" ? "建立分類" : "編輯分類"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="分類名稱"
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              fullWidth
            />
            <TextField
              label="用途筆記"
              value={collectionDescriptionInput}
              onChange={(event) =>
                setCollectionDescriptionInput(event.target.value)
              }
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectionDialogTarget(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={submitCollection}
            disabled={saveCollection.isPending}
          >
            儲存
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={moveMenu?.anchorEl ?? null}
        open={Boolean(moveMenu)}
        onClose={() => setMoveMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (moveMenu) moveLoreTo(moveMenu.lore, "");
            setMoveMenu(null);
          }}
        >
          移到未分類
        </MenuItem>
        {collections.map((collection) => (
          <MenuItem
            key={collection.public_id}
            onClick={() => {
              if (moveMenu) moveLoreTo(moveMenu.lore, collection.public_id);
              setMoveMenu(null);
            }}
          >
            移到「{collection.name}」
          </MenuItem>
        ))}
      </Menu>

      {deleteCollectionTarget && (
        <ConfirmNameDialog
          open
          title="刪除分類"
          description="刪除後不會影響其他分類。請輸入分類名稱確認。"
          confirmName={deleteCollectionTarget.name}
          confirmLabel="刪除分類"
          loading={deleteCollection.isPending}
          onClose={() => setDeleteCollectionTarget(null)}
          onConfirm={() =>
            deleteCollection.mutate(deleteCollectionTarget.public_id, {
              onSuccess: () => {
                setDeleteCollectionTarget(null);
                setSnack("分類已刪除。");
              },
              onError: (error) => setSnack(error.message),
            })
          }
        />
      )}

      {deleteLoreTarget && (
        <ConfirmNameDialog
          open
          title="刪除設定集"
          description="刪除後會移除這份設定集與版本資料。請輸入設定集名稱確認。"
          confirmName={deleteLoreTarget.title}
          confirmLabel="刪除設定集"
          loading={deleteLore.isPending}
          onClose={() => setDeleteLoreTarget(null)}
          onConfirm={() =>
            deleteLore.mutate(deleteLoreTarget.public_id, {
              onSuccess: () => {
                setDeleteLoreTarget(null);
                setSnack("設定集已刪除。");
              },
              onError: (error) => setSnack(error.message),
            })
          }
        />
      )}

      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity="info"
        onClose={() => setSnack("")}
      />
    </Stack>
  );
}
