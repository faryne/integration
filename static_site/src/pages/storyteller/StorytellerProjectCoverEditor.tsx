import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from "@mui/material";
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useUploadStorytellerAssets } from "@/apis/storyteller.ts";
import {
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
} from "@/data/storyteller.ts";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import type { StorytellerAsset } from "@/types/storyteller.ts";

type CoverLayout = "split" | "immersive";
type CoverFocalPoint = { x: number; y: number };

export interface StorytellerProjectCoverEditorProps {
  projectPublicId: string;
  coverAssetPublicId: string;
  coverUrl: string;
  coverLayout: CoverLayout;
  coverFocalPoint: CoverFocalPoint;
  onChange: (publicId: string, previewUrl: string) => void;
  onLayoutChange: (layout: CoverLayout) => void;
  onFocalPointChange: (point: CoverFocalPoint) => void;
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

// 準星標記：純顯示，蓋一層陰影確保在亮或暗的封面上都看得到。
function FocalPointMarker({ focalPoint }: { focalPoint: CoverFocalPoint }) {
  return (
    <CenterFocusStrongIcon
      htmlColor="#fff"
      sx={{
        position: "absolute",
        left: `${focalPoint.x * 100}%`,
        top: `${focalPoint.y * 100}%`,
        transform: "translate(-50%, -50%)",
        fontSize: 30,
        pointerEvents: "none",
        filter:
          "drop-shadow(0 0 2px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.85))",
      }}
    />
  );
}

// 在「完整原圖」上拖曳準星：容器用 object-fit: contain 完整顯示原圖（不裁切、不縮放
// 出界），容器內的正規化座標就直接等於圖片本身的正規化座標，拖到哪裡就是哪裡。
// 刻意不做成「在已裁切的預覽圖上拖」——封面被裁切後，容器座標跟原圖座標會因為目前
// 焦點而整組偏移，越拖離目前焦點越遠、換算誤差越大，游標會跟畫面內容對不上。
function CoverFocalPointPicker({
  coverUrl,
  focalPoint,
  onChange,
}: {
  coverUrl: string;
  focalPoint: CoverFocalPoint;
  onChange: (point: CoverFocalPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function pointFromEvent(event: { clientX: number; clientY: number }) {
    const el = containerRef.current;
    if (!el) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (point) {
      onChange(point);
    }
  }
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return;
    }
    const point = pointFromEvent(event);
    if (point) {
      onChange(point);
    }
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <Box
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      sx={{
        position: "relative",
        height: 220,
        bgcolor: "common.black",
        cursor: "crosshair",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      <Box
        component="img"
        src={coverUrl}
        alt="完整封面圖，點擊或拖曳標記焦點"
        draggable={false}
        sx={{
          position: "absolute",
          inset: 0,
          width: 1,
          height: 1,
          // contain：完整原圖等比縮放置中顯示，不裁切——容器座標才能直接對應圖片座標。
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
      <FocalPointMarker focalPoint={focalPoint} />
    </Box>
  );
}

// 依目前版型模擬桌機作品首頁實際會裁成什麼樣子；純顯示，不可拖曳（拖曳在上面的
// CoverFocalPointPicker 進行，這裡的裁切結果會跟著即時更新）。
function CoverLayoutPreview({
  coverUrl,
  coverLayout,
  coverFocalPoint,
}: {
  coverUrl: string;
  coverLayout: CoverLayout;
  coverFocalPoint: CoverFocalPoint;
}) {
  const objectPosition = `${coverFocalPoint.x * 100}% ${coverFocalPoint.y * 100}%`;

  if (coverLayout === "split") {
    return (
      <Box
        sx={{ display: "grid", gridTemplateColumns: "56% 44%", height: 220 }}
      >
        <Stack justifyContent="flex-end" spacing={1} sx={{ p: 2.5 }}>
          <Typography variant="caption" color="primary">
            作品類型 · 連載狀態
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            作品標題
          </Typography>
          <Typography variant="body2" color="text.secondary">
            作品簡介與作者資訊固定留在獨立區塊，不會蓋住封面。
          </Typography>
        </Stack>
        <Box
          component="img"
          src={coverUrl}
          alt="圖文分區封面預覽"
          sx={{
            width: 1,
            height: 1,
            objectFit: "cover",
            objectPosition,
            display: "block",
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative", height: 220, overflow: "hidden" }}>
      <Box
        component="img"
        src={coverUrl}
        alt="沉浸式封面預覽"
        sx={{
          width: 1,
          height: 1,
          objectFit: "cover",
          objectPosition,
          display: "block",
        }}
      />
      <Stack
        justifyContent="flex-end"
        spacing={1}
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          width: "68%",
          p: 2.5,
          background: `linear-gradient(90deg, ${theme.palette.background.paper} 48%, ${alpha(theme.palette.background.paper, 0.82)} 75%, transparent 100%)`,
        })}
      >
        <Typography variant="caption" color="primary">
          左側文字安全區
        </Typography>
        <Typography variant="h5" fontWeight={800}>
          作品標題
        </Typography>
        <Typography variant="body2" color="text.secondary">
          重要人物與視覺焦點建議放在右半側。
        </Typography>
      </Stack>
    </Box>
  );
}

// 編輯專案用的封面區塊：從資產挑選或走既有資產上傳 hook，上傳完成後自動設為封面。
export function StorytellerProjectCoverEditor({
  projectPublicId,
  coverAssetPublicId,
  coverUrl,
  coverLayout,
  coverFocalPoint,
  onChange,
  onLayoutChange,
  onFocalPointChange,
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
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {coverUrl ? (
          <CoverFocalPointPicker
            coverUrl={coverUrl}
            focalPoint={coverFocalPoint}
            onChange={onFocalPointChange}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={0.5}
            sx={{ height: 220, bgcolor: "action.hover" }}
          >
            <ImageIcon color="disabled" />
            <Typography variant="body2" color="text.secondary">
              尚未設定封面
            </Typography>
          </Stack>
        )}
      </Box>
      {coverUrl && (
        <>
          <Typography variant="caption" color="text.secondary">
            點擊或拖曳上方原圖裡的準星，標記要保留可見的焦點；下面是套用目前版型後
            實際會裁成的樣子。
          </Typography>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <CoverLayoutPreview
              coverUrl={coverUrl}
              coverLayout={coverLayout}
              coverFocalPoint={coverFocalPoint}
            />
          </Box>
        </>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={coverLayout}
        onChange={(_, value: CoverLayout | null) =>
          value && onLayoutChange(value)
        }
        aria-label="作品首頁封面版型"
      >
        <ToggleButton value="split">圖文分區</ToggleButton>
        <ToggleButton value="immersive">沉浸式封面</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary">
        {coverLayout === "immersive"
          ? "適合 2:1 key art；桌機會在左側疊上標題與漸層，請把人物或視覺焦點留在右側。手機仍使用獨立橫幅。"
          : "通用預設；桌機將作品資訊與封面分開呈現，手機則把封面放在資訊上方。"}
      </Typography>
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
