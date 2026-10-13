import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Box, Typography } from "@mui/material";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

export interface StorytellerAssetDropzoneProps {
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  hint: ReactNode;
  onFilesSelected?: (files: File[]) => void;
  // 自己處理選檔（SteamLoom Writer：WebView 拿不到本機路徑，改用 Go 的原生選檔視窗）；
  // 有給就點擊時呼叫它，不用 <input type=file>、也不接拖放
  onPick?: () => void;
}

export function StorytellerAssetDropzone({
  accept,
  multiple = true,
  disabled = false,
  hint,
  onFilesSelected,
  onPick,
}: StorytellerAssetDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function selectFiles(files: FileList | null) {
    if (!files || disabled) {
      return;
    }
    onFilesSelected?.(Array.from(files));
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (disabled || onPick) {
      return;
    }
    event.preventDefault();
    setDragOver(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (onPick) {
      return;
    }
    setDragOver(false);
    selectFiles(event.dataTransfer.files);
  }

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled) {
          if (onPick) onPick();
          else fileInputRef.current?.click();
        }
      }}
      sx={{
        border: "2px dashed",
        borderColor: dragOver ? "primary.main" : "divider",
        borderRadius: 1,
        p: 4,
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        bgcolor: dragOver ? "action.hover" : "transparent",
        opacity: disabled ? 0.62 : 1,
      }}
    >
      <UploadFileIcon
        color={dragOver ? "primary" : "disabled"}
        fontSize="large"
      />
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {hint}
      </Typography>
      {!onPick && (
        <input
          ref={fileInputRef}
          type="file"
          accept={accept?.join(",")}
          multiple={multiple}
          disabled={disabled}
          hidden
          onChange={(event) => selectFiles(event.target.files)}
        />
      )}
    </Box>
  );
}
