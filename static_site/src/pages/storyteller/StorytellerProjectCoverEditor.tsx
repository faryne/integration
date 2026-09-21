import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageIcon from "@mui/icons-material/Image";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { useUploadStorytellerAssets } from "@/apis/storyteller.ts";
import {
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
} from "@/data/storyteller.ts";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import type { StorytellerAsset } from "@/types/storyteller.ts";

export interface StorytellerProjectCoverEditorProps {
  projectPublicId: string;
  coverAssetPublicId: string;
  coverUrl: string;
  onChange: (publicId: string, previewUrl: string) => void;
  onNotify: (message: string, severity: "success" | "error") => void;
}

function errorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    return data.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

// 編輯專案用的封面區塊：從資產挑選或走既有資產上傳 hook，上傳完成後自動設為封面。
export function StorytellerProjectCoverEditor({
  projectPublicId,
  coverAssetPublicId,
  coverUrl,
  onChange,
  onNotify,
}: StorytellerProjectCoverEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAssets = useUploadStorytellerAssets(projectPublicId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);
  const hasCover = Boolean(coverAssetPublicId || coverUrl);

  function handleSelect(asset: StorytellerAsset) {
    onChange(asset.public_id, asset.preview_url);
    setPickerOpen(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
      onNotify("封面只接受 JPEG／PNG／WebP／GIF 圖片檔。", "error");
      return;
    }
    if (file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES) {
      onNotify(`封面圖片不能超過 ${maxMB}MB。`, "error");
      return;
    }
    try {
      const uploaded = await uploadAssets.mutateAsync({ files: [file] });
      const asset = uploaded[0];
      if (!asset) {
        onNotify("上傳完成但沒有取得資產資料，請重試。", "error");
        return;
      }
      onChange(asset.public_id, asset.preview_url);
      onNotify("已上傳並設為封面，請記得儲存專案。", "success");
    } catch (error) {
      onNotify(errorMessage(error, "上傳封面失敗，請重試。"), "error");
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={700}>
        封面
      </Typography>
      <Box
        sx={{
          height: 180,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {coverUrl ? (
          <Box
            component="img"
            src={coverUrl}
            alt="專案封面預覽"
            sx={{
              width: 1,
              height: 1,
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
        ) : (
          <Stack alignItems="center" spacing={0.5} sx={{ px: 2 }}>
            <ImageIcon color="disabled" />
            <Typography variant="body2" color="text.secondary">
              尚未設定封面
            </Typography>
          </Stack>
        )}
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ImageIcon />}
          onClick={() => setPickerOpen(true)}
        >
          從資產選取
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<UploadFileIcon />}
          disabled={uploadAssets.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadAssets.isPending ? "上傳中" : "上傳圖片"}
        </Button>
        {hasCover && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setRemoveOpen(true)}
          >
            移除封面
          </Button>
        )}
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept={STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.join(",")}
        hidden
        onChange={(event) => void handleUpload(event.target.files)}
      />
      <StorytellerAssetPickerDialog
        open={pickerOpen}
        projectPublicId={projectPublicId}
        title="選擇封面"
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
      <Dialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>移除封面</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            確定要移除這個專案的封面嗎？資產本身不會被刪除。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveOpen(false)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              onChange("", "");
              setRemoveOpen(false);
            }}
          >
            移除封面
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
