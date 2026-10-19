import DeleteIcon from "@mui/icons-material/Delete";
import FolderIcon from "@mui/icons-material/Folder";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { formatStorytellerDate } from "@/data/storytellerDate.ts";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSelectButton,
} from "./ProjectWorkspaceEditorControls.tsx";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import type { WorkspaceViewMode } from "./workspaceViewMode.ts";
import type { StorytellerAsset } from "@/types/storyteller.ts";

// 資產卡片與資產詳細面板，網站工作台與 SteamLoom Writer 共用（Writer 透過 alias 直接 import，改這支也會影響 Writer）。
// 這支不碰 API：存檔／移動／刪除由外層以 props 傳入（網站接 react-query，Writer 接 Go 綁定）。

// 只列畫面用到的欄位，Writer 的資產資料沒有內部 id／project_id 也能直接傳進來
export type WorkspaceAsset = Omit<
  StorytellerAsset,
  "id" | "project_id" | "asset_type"
> & { asset_type: string };

export interface WorkspaceAssetInput {
  title: string;
  alt_text: string;
  description: string;
  metadata: Record<string, unknown>;
}

function formatAssetFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ textAlign: "right", wordBreak: "break-all" }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export function AssetCard({
  asset,
  onClick,
  actions,
  collectionChip,
  viewMode = "grid",
}: {
  asset: WorkspaceAsset;
  onClick: () => void;
  actions?: ReactNode;
  collectionChip?: ReactNode;
  viewMode?: WorkspaceViewMode;
}) {
  const { t } = useTranslation();

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        borderRadius: 0,
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
        cursor: "pointer",
        display: viewMode === "list" ? "flex" : "block",
        bgcolor: "background.paper",
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
        },
      }}
    >
      <Box
        component="img"
        src={asset.preview_url}
        alt={asset.alt_text || storytellerAssetTitle(asset)}
        sx={{
          width: viewMode === "list" ? { xs: 88, sm: 144 } : 1,
          aspectRatio: viewMode === "list" ? "1 / 1" : "16 / 9",
          objectFit: "cover",
          display: "block",
          borderRadius: 0,
          flexShrink: 0,
        }}
      />
      <Box sx={{ p: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={900} noWrap>
              {storytellerAssetTitle(asset)}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {t("writer:assets.references", {
                count: asset.reference_count,
              })}{" "}
              · {asset.mime_type}
            </Typography>
            {collectionChip && <Box sx={{ mt: 0.5 }}>{collectionChip}</Box>}
          </Box>
          {actions && (
            <Box
              onClick={(event) => event.stopPropagation()}
              sx={{ flexShrink: 0 }}
            >
              {actions}
            </Box>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

// 資產沒有像故事/設定集那樣獨立的頁面元件可以嵌，metadata 也單純（標題／替代文字／
// 描述／所屬資產集），所以直接做一個右欄面板，視覺上比照 StoryEditor/LoreEditor 的
// embedded 版面（WorkspaceEditableTitle + 頂部存檔動作）。
// onUpdate／onMove／onDelete 失敗時要 reject 一個帶訊息的 Error，面板會顯示在 snack／刪除對話框。
export function AssetDetailPanel({
  asset,
  assetCollections,
  onUpdate,
  onMove,
  onDelete,
  onDeleted,
}: {
  asset: WorkspaceAsset;
  assetCollections: Array<{ public_id: string; name: string }>;
  onUpdate: (input: WorkspaceAssetInput) => Promise<unknown>;
  onMove: (collectionId: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.alt_text);
  const [description, setDescription] = useState(asset.description);
  const [collectionId, setCollectionId] = useState(asset.collection_id ?? "");
  const [snack, setSnack] = useState<{ message: string; severity: AlertColor }>(
    {
      message: "",
      severity: "success",
    },
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const collectionOptions = [
    {
      value: "",
      label: t("writer:assets.uncategorized"),
      icon: <FolderIcon fontSize="small" />,
    },
    ...assetCollections.map((collection) => ({
      value: collection.public_id,
      label: collection.name,
      icon: <FolderIcon fontSize="small" />,
    })),
  ];

  const metadata = asset.metadata ?? {};
  const width = metadata.width;
  const height = metadata.height;
  const dimensionLabel =
    typeof width === "number" && typeof height === "number"
      ? `${width} × ${height}`
      : "";
  // 寬高已經另外拆成獨立欄位顯示，其餘 metadata（例如上傳時額外記下的資訊）就
  // 原樣列出剩下的 key，不特別假設有哪些欄位。
  const extraMetadataEntries = Object.entries(metadata).filter(
    ([key]) => key !== "width" && key !== "height",
  );

  async function handleSave() {
    setSaving(true);
    try {
      try {
        await onUpdate({
          title,
          alt_text: altText,
          description,
          metadata: asset.metadata ?? {},
        });
      } catch {
        setSnack({
          message: t("writer:assets.updateFailed"),
          severity: "error",
        });
        return;
      }
      // 資訊與分類是兩次獨立儲存；第二步失敗要說明第一步已成功，避免誤導使用者。
      if (collectionId !== (asset.collection_id ?? "")) {
        try {
          await onMove(collectionId);
        } catch {
          setSnack({
            message: t("writer:assets.moveFailed"),
            severity: "error",
          });
          return;
        }
      }
      setSnack({ message: t("writer:assets.updated"), severity: "success" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      setDeleteOpen(false);
      onDeleted();
    } catch (error) {
      const message =
        (error instanceof Error && error.message) ||
        t("writer:assets.deleteFailed");
      setDeleteError(message);
      setSnack({ message, severity: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const assetActionContent = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip
        label={`${t("writer:assets.references", {
          count: asset.reference_count,
        })} · ${asset.mime_type}`}
      />
      <Button
        size="small"
        variant={metadataOpen ? "contained" : "outlined"}
        startIcon={<InfoOutlinedIcon fontSize="small" />}
        onClick={() => setMetadataOpen((value) => !value)}
      >
        {t("writer:assets.details")}
      </Button>
      <Tooltip
        title={
          asset.reference_count > 0 ? t("writer:assets.referenced") : ""
        }
      >
        <span>
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon fontSize="small" />}
            disabled={asset.reference_count > 0}
            onClick={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
          >
            {t("writer:common.delete")}
          </Button>
        </span>
      </Tooltip>
      <Button
        size="small"
        variant="contained"
        startIcon={<SaveIcon fontSize="small" />}
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? t("writer:common.saving") : t("writer:common.save")}
      </Button>
    </Stack>
  );

  return (
    <Stack spacing={2.25}>
      <WorkspaceEditorHeaderRow
        title={
          <WorkspaceEditableTitle
            value={title}
            onChange={setTitle}
            placeholder={t("writer:assets.untitled")}
          />
        }
        actions={assetActionContent}
      />
      <Collapse in={metadataOpen} timeout="auto" unmountOnExit>
        <Stack
          spacing={1}
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
          }}
        >
          <MetadataRow
            label={t("writer:assets.originalName")}
            value={asset.original_filename || "—"}
          />
          <MetadataRow
            label={t("writer:assets.type")}
            value={`${asset.asset_type} · ${asset.mime_type}${asset.file_ext ? ` · .${asset.file_ext}` : ""}`}
          />
          <MetadataRow
            label={t("writer:assets.fileSize")}
            value={formatAssetFileSize(asset.file_size)}
          />
          {dimensionLabel && (
            <MetadataRow
              label={t("writer:assets.dimensions")}
              value={dimensionLabel}
            />
          )}
          <MetadataRow label="Public ID" value={asset.public_id} />
          <MetadataRow
            label={t("writer:assets.createdAt")}
            value={formatStorytellerDate(
              asset.created_at,
              i18n.resolvedLanguage,
            )}
          />
          <MetadataRow
            label={t("writer:assets.updatedAt")}
            value={formatStorytellerDate(
              asset.updated_at,
              i18n.resolvedLanguage,
            )}
          />
          {extraMetadataEntries.length > 0 && (
            <>
              <Divider sx={{ my: 0.5 }} />
              {extraMetadataEntries.map(([key, value]) => (
                <MetadataRow
                  key={key}
                  label={key}
                  value={
                    typeof value === "string" ? value : JSON.stringify(value)
                  }
                />
              ))}
            </>
          )}
        </Stack>
      </Collapse>
      <WorkspaceEditorSelectButton
        icon={<FolderIcon fontSize="small" />}
        label={t("writer:assets.collection")}
        value={collectionId}
        options={collectionOptions}
        // 沒有資產集（只剩未分類）時沒得選
        disabled={collectionOptions.length <= 1}
        onChange={setCollectionId}
      />
      <Box
        component="img"
        src={asset.preview_url}
        alt={altText || storytellerAssetTitle(asset)}
        sx={{
          width: 1,
          maxHeight: 480,
          objectFit: "contain",
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      />
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t("writer:assets.altText")}
        </Typography>
        <WorkspaceEditableSummary
          value={altText}
          onChange={setAltText}
          placeholder={t("writer:assets.altHelp")}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t("writer:assets.description")}
        </Typography>
        <WorkspaceEditableSummary
          value={description}
          onChange={setDescription}
          placeholder={t("writer:assets.descriptionHelp")}
        />
      </Box>
      <CustomSnackbar
        open={Boolean(snack.message)}
        message={snack.message}
        severity={snack.severity}
        onClose={() => setSnack((current) => ({ ...current, message: "" }))}
      />
      <StorytellerConfirmNameDialog
        open={deleteOpen}
        title={t("writer:assets.deleteTitle")}
        description={t("writer:assets.deleteDescription")}
        confirmName={storytellerAssetTitle(asset)}
        confirmLabel={t("writer:assets.deleteTitle")}
        loading={deleting}
        error={deleteError}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
        onConfirm={() => void handleDelete()}
      />
    </Stack>
  );
}
