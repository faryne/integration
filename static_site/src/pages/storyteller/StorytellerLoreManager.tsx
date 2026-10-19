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
import type { AlertColor } from "@mui/material";
import type { TFunction } from "i18next";
import { useEffect, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteStorytellerLore,
  useDeleteStorytellerLoreCollection,
  useMoveStorytellerLore,
  useSaveStorytellerLoreCollection,
  useStorytellerLoreCollections,
  useStorytellerLoresPage,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
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

function collectionDescription(
  collection: StorytellerLoreCollection,
  t: TFunction,
) {
  return collection.description.trim()
    ? t("web.loreManager.collection.dropHintWithDescription", {
        name: collection.name,
        description: collection.description,
      })
    : t("web.loreManager.collection.dropHint", { name: collection.name });
}

export function StorytellerLoreManager({
  projectPublicId,
}: {
  projectPublicId: string;
}) {
  const { t, i18n } = useTranslation();
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
  const [snack, setSnack] = useState<{ message: string; severity: AlertColor }>(
    {
      message: "",
      severity: "success",
    },
  );
  const notify = (message: string, severity: AlertColor = "success") =>
    setSnack({ message, severity });
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

  function moveLoreTo(
    lore: StorytellerLore,
    collectionId: string,
    quietSuccess = false,
  ) {
    const targetCollectionId =
      collectionId === loreCollectionUncategorized ? "" : collectionId;
    moveLore.mutate(
      { lorePublicId: lore.public_id, collectionId: targetCollectionId },
      {
        onSuccess: () => {
          if (!quietSuccess)
            notify(
              targetCollectionId
                ? t("web.loreManager.messages.movedToCollection")
                : t("web.loreManager.messages.movedUncategorized"),
            );
        },
        onError: (error) => notify(error.message, "error"),
      },
    );
  }

  function handleCollectionDrop(
    event: DragEvent<HTMLElement>,
    collectionId: string,
  ) {
    event.preventDefault();
    if (draggingLore) moveLoreTo(draggingLore, collectionId, true);
    setDraggingLore(null);
  }

  function submitCollection() {
    const name = collectionName.trim();
    if (!name) {
      notify(t("web.loreManager.errors.collectionNameRequired"), "error");
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
          notify(
            collectionDialogTarget === "new"
              ? t("web.loreManager.messages.collectionCreated")
              : t("web.loreManager.messages.collectionUpdated"),
          );
        },
        onError: (error) => notify(error.message, "error"),
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
          {t("web.loreManager.title")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            startIcon={<CreateNewFolderIcon />}
            variant="outlined"
            onClick={() => openCollectionDialog("new")}
          >
            {t("web.loreManager.collection.create")}
          </Button>
          <Button
            href={steamloomPath(`my/project/${projectPublicId}/lore/new`)}
            variant="contained"
          >
            {t("web.loreManager.createLore")}
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Tooltip title={t("web.loreManager.showAll")}>
            <Button
              size="small"
              variant={selectedCollectionId === "" ? "contained" : "outlined"}
              startIcon={<FolderIcon />}
              onClick={() => setSelectedCollectionId("")}
            >
              {t("web.common.all")}
            </Button>
          </Tooltip>
          <Tooltip title={t("web.loreManager.uncategorizedDropHint")}>
            <Button
              size="small"
              variant={
                selectedCollectionId === loreCollectionUncategorized
                  ? "contained"
                  : "outlined"
              }
              startIcon={<DragIndicatorIcon />}
              onClick={() =>
                setSelectedCollectionId(loreCollectionUncategorized)
              }
              onDragOver={(event) => handleCollectionDragOver(event, "")}
              onDrop={(event) => handleCollectionDrop(event, "")}
              sx={dropTargetSx(canDropDraggingLore(""))}
            >
              {t("web.loreManager.uncategorized")}
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
                selectedCollectionId === collection.public_id
                  ? "contained"
                  : "outlined"
              }
              sx={dropTargetSx(canDropDraggingLore(collection.public_id))}
            >
              <Tooltip title={collectionDescription(collection, t)}>
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
              <Tooltip title={t("web.loreManager.collection.edit")}>
                <Button onClick={() => openCollectionDialog(collection)}>
                  <EditIcon fontSize="small" />
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  collection.lore_count > 0
                    ? t("web.loreManager.collection.deleteBlocked")
                    : t("web.loreManager.collection.delete")
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
          <Typography color="text.secondary">
            {t("web.loreManager.loading")}
          </Typography>
        </Paper>
      ) : lores.length === 0 ? (
        <CustomEmptyState
          icon={<MenuBookIcon fontSize="large" />}
          title={t("web.loreManager.emptyTitle")}
          description={t("web.loreManager.emptyDescription")}
        />
      ) : (
        <Stack spacing={1.5}>
          {lores.map((lore) => (
            <Tooltip
              key={lore.public_id}
              title={t("web.loreManager.dragHint")}
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
                  opacity:
                    draggingLore?.public_id === lore.public_id ? 0.55 : 1,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <MenuBookIcon color="primary" />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800}>{lore.title}</Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t("web.projectWorkspace.meta.words", {
                          count: lore.word_count.toLocaleString(
                            i18n.resolvedLanguage,
                          ),
                        })}{" "}
                        ·{" "}
                        {formatStorytellerDate(
                          lore.updated_at,
                          i18n.resolvedLanguage,
                        )}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<FolderIcon />}
                        label={
                          collections.find(
                            (collection) =>
                              collection.public_id === lore.collection_id,
                          )?.name ?? t("web.loreManager.uncategorized")
                        }
                      />
                    </Stack>
                  </Stack>
                  <Tooltip title={t("web.loreManager.moveLore")}>
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
                    {t("web.common.edit")}
                  </Button>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteLoreTarget(lore)}
                  >
                    {t("web.common.delete")}
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
          {collectionDialogTarget === "new"
            ? t("web.loreManager.collection.create")
            : t("web.loreManager.collection.edit")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("web.loreManager.collection.name")}
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              fullWidth
            />
            <TextField
              label={t("web.loreManager.collection.description")}
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
          <Button onClick={() => setCollectionDialogTarget(null)}>
            {t("web.common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={submitCollection}
            disabled={saveCollection.isPending}
          >
            {t("web.common.save")}
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
          {t("web.loreManager.moveUncategorized")}
        </MenuItem>
        {collections.map((collection) => (
          <MenuItem
            key={collection.public_id}
            onClick={() => {
              if (moveMenu) moveLoreTo(moveMenu.lore, collection.public_id);
              setMoveMenu(null);
            }}
          >
            {t("web.loreManager.moveTo", { name: collection.name })}
          </MenuItem>
        ))}
      </Menu>

      {deleteCollectionTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.loreManager.collection.delete")}
          description={t("web.loreManager.collection.deleteDescription")}
          confirmName={deleteCollectionTarget.name}
          confirmLabel={t("web.loreManager.collection.delete")}
          loading={deleteCollection.isPending}
          onClose={() => setDeleteCollectionTarget(null)}
          onConfirm={() =>
            deleteCollection.mutate(deleteCollectionTarget.public_id, {
              onSuccess: () => {
                setDeleteCollectionTarget(null);
                notify(t("web.loreManager.messages.collectionDeleted"));
              },
              onError: (error) => notify(error.message, "error"),
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
                setDeleteLoreTarget(null);
                notify(t("web.loreManager.messages.loreDeleted"));
              },
              onError: (error) => notify(error.message, "error"),
            })
          }
        />
      )}

      <CustomSnackbar
        open={Boolean(snack.message)}
        message={snack.message}
        severity={snack.severity}
        onClose={() => setSnack((current) => ({ ...current, message: "" }))}
      />
    </Stack>
  );
}
