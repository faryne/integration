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
} from "@mui/material";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useUploadStorytellerAssets } from "@/apis/storyteller.ts";
import {
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
} from "@/data/storyteller.ts";
import { WorkLandingHero } from "@/pages/storyteller/ReaderWorkLanding.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import {
  type EditorPickerAsset,
  useEditorData,
} from "@/pages/storyteller/StorytellerEditorDataContext.ts";

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

// 依目前版型呈現封面：直接重用目次頁 Hero 的 WorkLandingHero（同一份 markup），排版、
// 比例都跟真正的閱讀頁一致，不用自己另外刻一份、以後 Hero 改版也不會忘記同步兩邊。
// 焦點只有沉浸式版型才生效（見 storytellerCoverObjectPosition），所以拖曳準星也只
// 疊在沉浸式版型上；圖文分區交給 WorkLandingHero 原樣顯示，不用拖曳。
// 沉浸式在桌機是用 background-image 鋪成 Hero 底圖（不是 <img> 標籤），拖曳換算的
// 「容器」因此是 Hero 外層那個盒子本身，公式跟 background-size: cover 的裁切規則一致；
// 原圖的原始尺寸另外用 Image() 預先載入取得，不依賴某個 DOM 節點的 onLoad（沉浸式
// 桌機版本本來就沒有真正的 <img> 節點可以掛）。手機寬度下沉浸式改用獨立的 16:9 <img>，
// 跟這裡的換算公式對不上，所以拖曳疊層只在桌機寬度顯示，手機仍會正確顯示
// WorkLandingHero 原本的樣子，只是不能在這裡拖。
function CoverPreview({
  coverUrl,
  coverLayout,
  coverFocalPoint,
  onFocalPointChange,
}: {
  coverUrl: string;
  coverLayout: CoverLayout;
  coverFocalPoint: CoverFocalPoint;
  onFocalPointChange: (point: CoverFocalPoint) => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = coverUrl;
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  function pointFromEvent(event: { clientX: number; clientY: number }) {
    const el = containerRef.current;
    if (!el || !naturalSize || naturalSize.w <= 0 || naturalSize.h <= 0) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    // background-size: cover 的縮放比例：取「剛好蓋滿容器」的那個較大值。
    const scale = Math.max(
      rect.width / naturalSize.w,
      rect.height / naturalSize.h,
    );
    const scaledW = naturalSize.w * scale;
    const scaledH = naturalSize.h * scale;
    // 縮放後超出容器的量，就是目前焦點能造成的最大位移範圍。
    const overflowX = Math.max(scaledW - rect.width, 0);
    const overflowY = Math.max(scaledH - rect.height, 0);
    const cx = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const cy = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    return {
      x: Math.min(
        Math.max((cx + coverFocalPoint.x * overflowX) / scaledW, 0),
        1,
      ),
      y: Math.min(
        Math.max((cy + coverFocalPoint.y * overflowY) / scaledH, 0),
        1,
      ),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (point) {
      onFocalPointChange(point);
    }
  }
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return;
    }
    const point = pointFromEvent(event);
    if (point) {
      onFocalPointChange(point);
    }
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <Box sx={{ position: "relative" }}>
      <WorkLandingHero
        name={t("writer.projectCover.sampleTitle")}
        description={t("writer.projectCover.sampleDescription")}
        coverUrl={coverUrl}
        coverLayout={coverLayout}
        coverFocalPoint={coverFocalPoint}
        meta={
          <Typography variant="body2" color="text.secondary">
            {t("writer.projectCover.sampleMeta")}
          </Typography>
        }
      />
      {coverLayout === "immersive" && (
        <Box
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          sx={{
            position: "absolute",
            inset: 0,
            // 手機寬度沉浸式改用獨立 16:9 <img>，跟這裡的裁切公式對不上，先不開放拖曳。
            display: { xs: "none", md: "block" },
            cursor: "crosshair",
            touchAction: "none",
          }}
        >
          <FocalPointMarker focalPoint={coverFocalPoint} />
        </Box>
      )}
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
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAssets = useUploadStorytellerAssets(projectPublicId);
  const { pickAndUploadImage } = useEditorData();
  const [hostUploading, setHostUploading] = useState(false);
  const uploading = uploadAssets.isPending || hostUploading;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);
  const hasCover = Boolean(coverAssetPublicId || coverUrl);

  function handleSelect(asset: EditorPickerAsset) {
    onChange(asset.public_id, asset.preview_url);
    setPickerOpen(false);
  }

  // 宿主（Writer）提供的上傳：格式與大小由宿主檢查，這裡只處理結果
  async function handleHostUpload() {
    if (!pickAndUploadImage) return;
    setHostUploading(true);
    try {
      const asset = await pickAndUploadImage(projectPublicId);
      if (!asset) return;
      onChange(asset.public_id, asset.preview_url);
      onNotify(t("writer.projectCover.uploaded"), "success");
    } catch (error) {
      onNotify(errorMessage(error, t("writer.projectCover.uploadFailed")), "error");
    } finally {
      setHostUploading(false);
    }
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
      onNotify(t("writer.projectCover.invalidType"), "error");
      return;
    }
    if (file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES) {
      onNotify(t("writer.projectCover.maxSize", { size: maxMB }), "error");
      return;
    }
    try {
      const uploaded = await uploadAssets.mutateAsync({ files: [file] });
      const asset = uploaded[0];
      if (!asset) {
        onNotify(t("writer.projectCover.missingAsset"), "error");
        return;
      }
      onChange(asset.public_id, asset.preview_url);
      onNotify(t("writer.projectCover.uploaded"), "success");
    } catch (error) {
      onNotify(errorMessage(error, t("writer.projectCover.uploadFailed")), "error");
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={700}>
        {t("writer.projectCover.title")}
      </Typography>
      {coverUrl ? (
        // 不另外包一層 border——WorkLandingHero 自己就有跟閱讀頁一致的邊框，
        // 疊上去只會變成雙重框線。
        <CoverPreview
          coverUrl={coverUrl}
          coverLayout={coverLayout}
          coverFocalPoint={coverFocalPoint}
          onFocalPointChange={onFocalPointChange}
        />
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={0.5}
          sx={{
            height: 220,
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <ImageIcon color="disabled" />
          <Typography variant="body2" color="text.secondary">
            {t("writer.projectCover.empty")}
          </Typography>
        </Stack>
      )}
      {coverUrl && coverLayout === "immersive" && (
        <Typography variant="caption" color="text.secondary">
          {t("writer.projectCover.focusHelp")}
        </Typography>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={coverLayout}
        onChange={(_, value: CoverLayout | null) =>
          value && onLayoutChange(value)
        }
        aria-label={t("writer.projectCover.layout")}
      >
        <ToggleButton value="split">{t("writer.projectCover.split")}</ToggleButton>
        <ToggleButton value="immersive">{t("writer.projectCover.immersive")}</ToggleButton>
      </ToggleButtonGroup>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ImageIcon />}
          onClick={() => setPickerOpen(true)}
        >
          {t("writer.projectCover.pick")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<UploadFileIcon />}
          disabled={uploading}
          onClick={() =>
            pickAndUploadImage
              ? void handleHostUpload()
              : fileInputRef.current?.click()
          }
        >
          {t(uploading ? "writer.projectCover.uploading" : "writer.projectCover.upload")}
        </Button>
        {hasCover && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setRemoveOpen(true)}
          >
            {t("writer.projectCover.remove")}
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
        title={t("writer.projectCover.pickerTitle")}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
      <Dialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("writer.projectCover.remove")}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {t("writer.projectCover.removeDescription")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveOpen(false)}>{t("writer.common.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              onChange("", "");
              setRemoveOpen(false);
            }}
          >
            {t("writer.projectCover.remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
