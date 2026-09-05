import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type {
  UploadItem,
  UploadMetadata,
  UploadProgress,
} from "@/pages/storyteller/StorytellerAssetUploadDrawer.tsx";

interface StorytellerAssetUploadDrawerItemProps {
  item: UploadItem;
  progress?: UploadProgress;
  onToggleMetadata: (itemId: string) => void;
  onMetadataChange: (
    itemId: string,
    key: keyof UploadMetadata,
    value: string,
  ) => void;
  onMetadataBlur: (itemId: string) => void;
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

function uploadPercent(item: UploadItem, progress?: UploadProgress) {
  if (progress && progress.total > 0) {
    return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
  }
  return item.asset ? 100 : 0;
}

export function StorytellerAssetUploadDrawerItem({
  item,
  progress,
  onToggleMetadata,
  onMetadataChange,
  onMetadataBlur,
}: StorytellerAssetUploadDrawerItemProps) {
  const percent = uploadPercent(item, progress);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            component="img"
            src={item.previewUrl}
            alt={item.metadata.alt_text || item.file.name}
            sx={{
              width: 112,
              height: 76,
              objectFit: "cover",
              borderRadius: 1,
              bgcolor: "background.default",
            }}
          />
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>
                  {item.file.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(item.file.size)}
                </Typography>
              </Box>
              <Tooltip title="編輯上傳資訊">
                <IconButton
                  size="small"
                  onClick={() => onToggleMetadata(item.id)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ flex: 1 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ width: 44, textAlign: "right" }}
              >
                {percent}%
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Collapse in={item.metadataOpen} unmountOnExit>
          <Divider sx={{ mb: 1.5 }} />
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="caption" color="text.secondary">
                {item.asset
                  ? "欄位離開焦點後會自動儲存。"
                  : "上傳完成後才會儲存。"}
              </Typography>
              {item.metadataStatus === "saving" && (
                <Chip size="small" label="儲存中" />
              )}
              {item.metadataStatus === "saved" && (
                <Chip
                  size="small"
                  color="success"
                  icon={<CheckCircleIcon />}
                  label="已儲存"
                />
              )}
              {item.metadataStatus === "error" && (
                <Chip size="small" color="error" label="儲存失敗" />
              )}
            </Stack>
            <TextField
              size="small"
              label="標題"
              value={item.metadata.title}
              onChange={(event) =>
                onMetadataChange(item.id, "title", event.target.value)
              }
              onBlur={() => onMetadataBlur(item.id)}
            />
            <TextField
              size="small"
              label="替代文字"
              value={item.metadata.alt_text}
              onChange={(event) =>
                onMetadataChange(item.id, "alt_text", event.target.value)
              }
              onBlur={() => onMetadataBlur(item.id)}
            />
            <TextField
              size="small"
              label="備註"
              value={item.metadata.description}
              multiline
              minRows={3}
              onChange={(event) =>
                onMetadataChange(item.id, "description", event.target.value)
              }
              onBlur={() => onMetadataBlur(item.id)}
            />
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
