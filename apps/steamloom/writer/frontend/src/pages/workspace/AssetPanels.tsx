import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { CollectionDialog, MoveMenu } from "@/pages/storyteller/ProjectWorkspacePreviewActionParts.tsx";
import { storytellerAssetTitle } from "@/pages/storyteller/storytellerAssetMarkdown.ts";
import { AssetCard, AssetDetailPanel } from "@/pages/storyteller/WorkspaceAssetPanel.tsx";
import CollectionsIcon from "@mui/icons-material/Collections";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FolderIcon from "@mui/icons-material/Folder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Button, Chip, CircularProgress, Grid, IconButton, Pagination, Stack, TextField, Tooltip } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Asset, type WorkspaceGroup } from "@writer/lib/backend.ts";
import { SessionExpiredContext, useBackendData } from "@writer/lib/useBackendData.ts";

// 資產列表與資產詳細頁，比照網站工作台（ProjectWorkspacePreviewActions／Components 的資產部分）：
// 卡片、⋮ 移動到資產集、刪除（仍被引用時停用）、搜尋、重新整理、上傳到目前的資產集、
// 選到某個資產集時可以編輯／刪除該資產集。共用元件都來自網站（AssetCard、MoveMenu、CollectionDialog…）。

// Go 綁定失敗時 reject 的是字串；授權失效交給外層切回登入頁，其他轉成 Error 讓共用元件顯示訊息
function useBackendAction() {
  const onSessionExpired = useContext(SessionExpiredContext);
  return <T,>(promise: Promise<T>) =>
    promise.catch((err: unknown) => {
      if (isNotLoggedIn(err)) onSessionExpired();
      throw new Error(errorMessage(err));
    });
}

export function AssetListPanel({
  project,
  collection,
  collections,
  version,
  onOpen,
  onSelectCollection,
  onUpload,
  onChanged,
}: {
  project: string;
  // 空字串＝全部、UNCATEGORIZED_ASSETS＝未分類、其他＝資產集 public_id
  collection: string;
  collections: WorkspaceGroup[];
  version: number;
  onOpen: (asset: Asset) => void;
  onSelectCollection: (collection: string) => void;
  onUpload: (collection: string) => void;
  // 移動、刪除、資產集編輯後通知外層重抓工作台（version 會跟著變，列表也會重抓）
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const action = useBackendAction();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  // 打字時不要每個字都重抓（重抓期間整個格狀列表會變回轉圈）
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [moveMenu, setMoveMenu] = useState<{ anchorEl: HTMLElement; asset: Asset } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingCollection, setEditingCollection] = useState<{ name: string; description: string } | null>(null);
  const [deletingCollection, setDeletingCollection] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(keyword), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);
  // 換資產集或搜尋字就回到第一頁
  useEffect(() => setPage(1), [collection, query]);
  // 每頁 24 筆，跟網站工作台一致
  const data = useBackendData(() => backend.Assets(project, collection, query, page, 24), [project, collection, query, page, version, refresh]);
  const current = collections.find((each) => each.public_id === collection);
  const assets = data?.assets ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total_count / data.page_size)) : 1;

  // 包住每個寫入操作：成功跳 snack 並重抓，失敗跳錯誤訊息；回傳是否成功
  const run = async (promise: Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action(promise);
      showSuccess(success);
      onChanged();
      return true;
    } catch (err) {
      showError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const moveAsset = async (asset: Asset, target: string) => {
    if ((asset.collection_id ?? "") !== target) await run(backend.MoveAsset(project, asset.public_id, target), t("workspace.assets.moved"));
    setMoveMenu(null);
  };

  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {current && (
          <>
            <Tooltip title={t("workspace.assets.editCollection")}>
              <IconButton size="small" onClick={() => setEditingCollection({ name: current.name, description: current.description })}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("workspace.assets.deleteCollection")}>
              <IconButton size="small" color="error" onClick={() => setDeletingCollection(true)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <TextField size="small" label={t("workspace.assets.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setRefresh((value) => value + 1)}>
          {t("workspace.assets.refresh")}
        </Button>
        <Button variant="contained" startIcon={<FileUploadIcon />} onClick={() => onUpload(current ? collection : "")}>
          {t("workspace.assets.upload")}
        </Button>
      </Stack>
      {data === null ? (
        <CircularProgress size={24} sx={{ m: 4 }} />
      ) : (
        <Grid container spacing={1.5}>
          {assets.map((asset) => {
            const owner = collections.find((each) => each.public_id === asset.collection_id);
            return (
              <Grid key={asset.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <AssetCard
                  asset={asset}
                  onClick={() => onOpen(asset)}
                  collectionChip={
                    owner && (
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<FolderIcon fontSize="small" />}
                        label={owner.name}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectCollection(owner.public_id);
                        }}
                        sx={{ height: 22, borderRadius: 1, fontWeight: 700 }}
                      />
                    )
                  }
                  actions={
                    <Stack direction="row" spacing={0.25}>
                      <Tooltip title={t("workspace.assets.move")}>
                        <IconButton size="small" onClick={(event) => setMoveMenu({ anchorEl: event.currentTarget, asset })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t(asset.reference_count > 0 ? "workspace.assets.referenced" : "workspace.assets.delete")}>
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
                    </Stack>
                  }
                />
              </Grid>
            );
          })}
          {assets.length === 0 && (
            <Grid size={12}>
              <WorkspaceEmptyState icon={<CollectionsIcon />} title={t("workspace.list.empty.asset.title")} description={t("workspace.list.empty.asset.description")} />
            </Grid>
          )}
          {pageCount > 1 && (
            <Grid size={12} sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
              <Pagination count={pageCount} page={page} onChange={(_, next) => setPage(next)} color="primary" />
            </Grid>
          )}
        </Grid>
      )}
      <MoveMenu
        anchorEl={moveMenu?.anchorEl ?? null}
        open={Boolean(moveMenu)}
        disabled={busy}
        currentId={moveMenu?.asset.collection_id ?? ""}
        rows={collections.map((each) => ({ id: each.public_id, publicId: each.public_id, name: each.name }))}
        ungroupedLabel={t("workspace.assets.moveToUncategorized")}
        onClose={() => setMoveMenu(null)}
        onMove={(target) => moveMenu && void moveAsset(moveMenu.asset, target)}
      />
      {deleteTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("workspace.assets.deleteTitle")}
          description={t("workspace.assets.deleteDescription")}
          confirmName={storytellerAssetTitle(deleteTarget)}
          confirmLabel={t("workspace.assets.deleteTitle")}
          loading={busy}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await action(backend.DeleteAsset(project, deleteTarget.public_id));
              setDeleteTarget(null);
              showSuccess(t("workspace.assets.deleted"));
              onChanged();
            } catch (err) {
              setDeleteError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      <CollectionDialog
        open={editingCollection !== null}
        title={t("workspace.assets.collection")}
        name={editingCollection?.name ?? ""}
        description={editingCollection?.description ?? ""}
        loading={busy}
        onNameChange={(name) => setEditingCollection((value) => value && { ...value, name })}
        onDescriptionChange={(description) => setEditingCollection((value) => value && { ...value, description })}
        onClose={() => setEditingCollection(null)}
        onSubmit={async () => {
          if (!editingCollection) return;
          const ok = await run(backend.UpdateAssetCollection(project, collection, editingCollection.name.trim(), editingCollection.description), t("workspace.assets.collectionSaved"));
          if (ok) setEditingCollection(null);
        }}
      />
      {deletingCollection && current && (
        <StorytellerConfirmNameDialog
          open
          title={t("workspace.assets.deleteCollection")}
          description={t("workspace.assets.deleteCollectionDescription")}
          confirmName={current.name}
          confirmLabel={t("workspace.assets.deleteCollection")}
          loading={busy}
          onClose={() => setDeletingCollection(false)}
          onConfirm={async () => {
            const ok = await run(backend.DeleteAssetCollection(project, collection), t("workspace.assets.collectionDeleted"));
            if (!ok) return;
            setDeletingCollection(false);
            // 刪掉的是目前看的資產集，回到全部資產
            onSelectCollection("");
          }}
        />
      )}
    </Box>
  );
}

// 資產詳細頁：網站的 AssetDetailPanel 接上 Go 綁定；版面寬度比照編輯頁置中
export function AssetDetail({
  project,
  asset,
  collections,
  onChanged,
  onDeleted,
}: {
  project: string;
  asset: Asset;
  collections: WorkspaceGroup[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const action = useBackendAction();
  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      <Box sx={{ maxWidth: 920, mx: "auto" }}>
        <AssetDetailPanel
          asset={asset}
          assetCollections={collections}
          onUpdate={(input) => action(backend.UpdateAsset(project, asset.public_id, input)).then(onChanged)}
          onMove={(target) => action(backend.MoveAsset(project, asset.public_id, target)).then(onChanged)}
          onDelete={() => action(backend.DeleteAsset(project, asset.public_id)).then(onChanged)}
          onDeleted={onDeleted}
        />
      </Box>
    </Box>
  );
}
