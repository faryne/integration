import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
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
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  useDeleteStorytellerAsset,
  useMoveStorytellerAsset,
  useUpdateStorytellerAsset,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSelectButton,
} from "./ProjectWorkspaceEditorControls.tsx";
import { WorkspaceConfirmNameDialog } from "./ProjectWorkspacePreviewActionParts.tsx";
import { storytellerAssetTitle } from "./storytellerAssetMarkdown.ts";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
  StorytellerLore,
  StorytellerStory,
} from "@/types/storyteller.ts";

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

function storyPageCount(story: StorytellerStory) {
  if (story.content_type !== "image") return 0;
  try {
    // 圖像故事的 latest_content 存的是 {"pages": [...]} 這個物件（StoryImageContent），
    // 不是裸陣列——之前這裡直接檢查 Array.isArray(parsed) 一定是 false，導致列表頁
    // 永遠顯示 0 頁，即使實際頁面數量正確存在。
    const parsed = JSON.parse(story.latest_content || "{}");
    const rows = parsed?.pages;
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

export function StoryRow({
  story,
  onClick,
  actions,
  collectionChip,
  reorderable,
  dragging,
  onDragStart,
  onDropRow,
}: {
  story: StorytellerStory;
  onClick: () => void;
  actions?: ReactNode;
  // 「全部作品」等混合分組的列表才需要標出這一列實際屬於哪一冊——已經篩選到
  // 單一分組時，每一列都屬於同一冊，標出來只是噪音，由呼叫端決定要不要傳。
  collectionChip?: ReactNode;
  reorderable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDropRow?: () => void;
}) {
  const isImage = story.content_type === "image";
  const isPublic = story.status === "completed";
  return (
    <Tooltip title={reorderable ? "可拖曳調整順序" : ""}>
      <Paper
        onClick={onClick}
        elevation={0}
        draggable={reorderable}
        onDragStart={reorderable ? onDragStart : undefined}
        onDragOver={reorderable ? (event) => event.preventDefault() : undefined}
        onDrop={
          reorderable
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                onDropRow?.();
              }
            : undefined
        }
        sx={{
          p: 1,
          borderRadius: 1,
          cursor: reorderable ? "grab" : "pointer",
          bgcolor: "transparent",
          opacity: dragging ? 0.55 : 1,
          "&:hover": {
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Box sx={{ color: "primary.main", lineHeight: 0 }}>
            {isImage ? (
              <ImageIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={story.title}>
              <Typography fontWeight={900} noWrap>
                {story.title}
              </Typography>
            </Tooltip>
            <Typography variant="body2" color="text.secondary" noWrap>
              {isImage
                ? `${storyPageCount(story)} 頁`
                : `${story.word_count.toLocaleString()} 字`}{" "}
              · 更新於 {formatStorytellerDate(story.updated_at)}
            </Typography>
          </Box>
          {collectionChip}
          <Chip
            size="small"
            label={isPublic ? "公開" : "草稿"}
            variant="outlined"
            sx={{
              height: 22,
              borderRadius: 1,
              fontWeight: 800,
              color: (theme) =>
                isPublic
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
              borderColor: (theme) =>
                isPublic ? theme.palette.primary.main : theme.palette.divider,
              bgcolor: (theme) =>
                isPublic
                  ? alpha(theme.palette.primary.main, 0.12)
                  : alpha(theme.palette.text.secondary, 0.06),
            }}
          />
          {actions && (
            <Box
              onClick={(event) => event.stopPropagation()}
              sx={{ flexShrink: 0 }}
            >
              {actions}
            </Box>
          )}
        </Stack>
      </Paper>
    </Tooltip>
  );
}

export function LoreRow({
  lore,
  onClick,
  actions,
  collectionChip,
}: {
  lore: StorytellerLore;
  onClick: () => void;
  actions?: ReactNode;
  collectionChip?: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1,
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: "transparent",
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Box sx={{ color: "primary.main", lineHeight: 0 }}>
          <DescriptionIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={lore.title}>
            <Typography fontWeight={900} noWrap>
              {lore.title}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" noWrap>
            {lore.word_count.toLocaleString()} 字 · 更新於{" "}
            {formatStorytellerDate(lore.updated_at)}
          </Typography>
        </Box>
        {collectionChip}
        {actions && (
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function AssetCard({
  asset,
  onClick,
  actions,
  collectionChip,
}: {
  asset: StorytellerAsset;
  onClick: () => void;
  actions?: ReactNode;
  collectionChip?: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        borderRadius: 1,
        overflow: "hidden",
        cursor: "pointer",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.035),
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#252525" : "#f1f1ef",
        },
      }}
    >
      <Box
        component="img"
        src={asset.preview_url}
        alt={asset.alt_text || storytellerAssetTitle(asset)}
        sx={{
          width: 1,
          aspectRatio: "16 / 9",
          objectFit: "cover",
          display: "block",
          borderRadius: 1,
        }}
      />
      <Box sx={{ p: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={900} noWrap>
              {storytellerAssetTitle(asset)}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              引用 {asset.reference_count} 次 · {asset.mime_type}
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
// 描述／所屬資產集），所以直接在這裡做一個自帶存檔/刪除邏輯的右欄面板，視覺上比照
// StoryEditor/LoreEditor 的 embedded 版面（WorkspaceEditableTitle + 頂部存檔動作），
// 取代原本的「編輯資產資訊」跳出視窗。
export function WorkspaceAssetPanel({
  asset,
  assetCollections,
  projectId,
  onDeleted,
}: {
  asset: StorytellerAsset;
  assetCollections: StorytellerAssetCollection[];
  projectId: string;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.alt_text);
  const [description, setDescription] = useState(asset.description);
  const [collectionId, setCollectionId] = useState(asset.collection_id ?? "");
  const [snack, setSnack] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const updateAsset = useUpdateStorytellerAsset(projectId);
  const moveAsset = useMoveStorytellerAsset(projectId);
  const deleteAsset = useDeleteStorytellerAsset(projectId);
  const saving = updateAsset.isPending || moveAsset.isPending;

  const collectionOptions = [
    { value: "", label: "未分類", icon: <FolderIcon fontSize="small" /> },
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

  function handleSave() {
    updateAsset.mutate(
      {
        assetPublicId: asset.public_id,
        input: {
          title,
          alt_text: altText,
          description,
          metadata: asset.metadata ?? {},
        },
      },
      {
        onSuccess: () => setSnack("資產已更新。"),
        onError: () => setSnack("資產更新失敗，請重試。"),
      },
    );
    if (collectionId !== (asset.collection_id ?? "")) {
      moveAsset.mutate({ assetPublicId: asset.public_id, collectionId });
    }
  }

  const assetActionContent = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip label={`引用 ${asset.reference_count} 次 · ${asset.mime_type}`} />
      <Button
        size="small"
        variant={metadataOpen ? "contained" : "outlined"}
        startIcon={<InfoOutlinedIcon fontSize="small" />}
        onClick={() => setMetadataOpen((value) => !value)}
      >
        詳細資訊
      </Button>
      <Button
        size="small"
        color="error"
        variant="outlined"
        startIcon={<DeleteIcon fontSize="small" />}
        onClick={() => setDeleteOpen(true)}
      >
        刪除
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<SaveIcon fontSize="small" />}
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? "儲存中" : "儲存"}
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
            placeholder="未命名資產"
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
            label="原始檔名"
            value={asset.original_filename || "—"}
          />
          <MetadataRow
            label="類型"
            value={`${asset.asset_type} · ${asset.mime_type}${asset.file_ext ? ` · .${asset.file_ext}` : ""}`}
          />
          <MetadataRow
            label="檔案大小"
            value={formatAssetFileSize(asset.file_size)}
          />
          {dimensionLabel && (
            <MetadataRow label="尺寸" value={dimensionLabel} />
          )}
          <MetadataRow label="Public ID" value={asset.public_id} />
          <MetadataRow
            label="建立時間"
            value={formatStorytellerDate(asset.created_at)}
          />
          <MetadataRow
            label="更新時間"
            value={formatStorytellerDate(asset.updated_at)}
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
        label="資產集"
        value={collectionId}
        options={collectionOptions}
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
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#151515" : "#f1f1ef",
        }}
      />
      <Box>
        <Typography variant="caption" color="text.secondary">
          替代文字
        </Typography>
        <WorkspaceEditableSummary
          value={altText}
          onChange={setAltText}
          placeholder="給無法看到圖片的讀者的簡短描述"
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          描述
        </Typography>
        <WorkspaceEditableSummary
          value={description}
          onChange={setDescription}
          placeholder="這個資產的補充說明（選填）"
        />
      </Box>
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        onClose={() => setSnack("")}
      />
      <WorkspaceConfirmNameDialog
        open={deleteOpen}
        title="刪除資產"
        description="刪除後無法復原。請輸入資產名稱確認。"
        confirmName={storytellerAssetTitle(asset)}
        confirmLabel="刪除資產"
        loading={deleteAsset.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteAsset.mutate(asset.public_id, {
            onSuccess: () => {
              setDeleteOpen(false);
              onDeleted();
            },
            onError: () => setSnack("資產刪除失敗，請重試。"),
          })
        }
      />
    </Stack>
  );
}
