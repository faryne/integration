import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  useUpdateStorytellerAsset,
  useUploadStorytellerAssets,
} from "@/apis/storyteller.ts";
import {
  STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES,
  STORYTELLER_IMAGE_PAGE_MAX_BYTES,
  STORYTELLER_IMAGE_PAGE_MAX_COUNT,
} from "@/data/storyteller.ts";
import { StorytellerAssetDropzone } from "@/pages/storyteller/StorytellerAssetDropzone.tsx";
import { StorytellerAssetUploadDrawerItem } from "@/pages/storyteller/StorytellerAssetUploadDrawerItem.tsx";
import type {
  StorytellerAsset,
  StorytellerAssetUpdateRequest,
} from "@/types/storyteller.ts";

type SnackSeverity = "success" | "error" | "info";
export type MetadataStatus = "idle" | "saving" | "saved" | "error";

export interface UploadProgress {
  name: string;
  loaded: number;
  total: number;
}

export interface UploadMetadata {
  title: string;
  alt_text: string;
  description: string;
}

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  metadata: UploadMetadata;
  metadataOpen: boolean;
  metadataStatus: MetadataStatus;
  savedMetadataSignature: string;
  asset?: StorytellerAsset;
}

export interface StorytellerAssetUploadDrawerProps {
  open: boolean;
  projectPublicId: string;
  collectionId: string;
  onClose: () => void;
  onUploaded: (uploaded: StorytellerAsset[]) => void;
  onNotify: (message: string, severity: SnackSeverity) => void;
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    return message || fallback;
  }
  return fallback;
}

function emptyMetadata(): UploadMetadata {
  return { title: "", alt_text: "", description: "" };
}

function metadataSignature(metadata: UploadMetadata) {
  return JSON.stringify([
    metadata.title.trim(),
    metadata.alt_text.trim(),
    metadata.description.trim(),
  ]);
}

function hasMetadataInput(metadata: UploadMetadata) {
  return Boolean(
    metadata.title.trim() ||
    metadata.alt_text.trim() ||
    metadata.description.trim(),
  );
}

function metadataUpdateInput(
  asset: StorytellerAsset,
  metadata: UploadMetadata,
): StorytellerAssetUpdateRequest {
  return {
    // confirm 建立資產時 title 預設是檔名；上傳當下沒填 title 時保留既有值。
    title: metadata.title.trim() || asset.title,
    alt_text: metadata.alt_text.trim() || asset.alt_text,
    description: metadata.description.trim() || asset.description,
    metadata: asset.metadata ?? {},
  };
}

function uploadItemId(file: File) {
  return `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StorytellerAssetUploadDrawer({
  open,
  projectPublicId,
  collectionId,
  onClose,
  onUploaded,
  onNotify,
}: StorytellerAssetUploadDrawerProps) {
  const uploadAssets = useUploadStorytellerAssets(projectPublicId);
  const updateAsset = useUpdateStorytellerAsset(projectPublicId);
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading">("idle");
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, UploadProgress>
  >({});
  const maxMB = Math.floor(STORYTELLER_IMAGE_PAGE_MAX_BYTES / 1024 / 1024);

  function updateItems(updater: (current: UploadItem[]) => UploadItem[]) {
    setItems((current) => {
      const next = updater(current);
      itemsRef.current = next;
      return next;
    });
  }

  function clearItems() {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    itemsRef.current = [];
    setItems([]);
    setUploadProgress({});
  }

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  // Drawer 內的批次上傳也避免半途關頁，防止留下已 PUT 但尚未 confirm 的孤兒檔案。
  useEffect(() => {
    if (uploadPhase !== "uploading") {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadPhase]);

  async function saveMetadata(
    itemId: string,
    asset: StorytellerAsset,
    metadata: UploadMetadata,
  ) {
    const signature = metadataSignature(metadata);
    if (!hasMetadataInput(metadata)) {
      return;
    }
    updateItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, metadataStatus: "saving" } : item,
      ),
    );
    try {
      await updateAsset.mutateAsync({
        assetPublicId: asset.public_id,
        input: metadataUpdateInput(asset, metadata),
      });
      updateItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                asset: {
                  ...asset,
                  title: metadata.title.trim() || asset.title,
                  alt_text: metadata.alt_text.trim() || asset.alt_text,
                  description: metadata.description.trim() || asset.description,
                },
                metadataStatus: "saved",
                savedMetadataSignature: signature,
              }
            : item,
        ),
      );
    } catch (error) {
      updateItems((current) =>
        current.map((item) =>
          item.id === itemId ? { ...item, metadataStatus: "error" } : item,
        ),
      );
      onNotify(errorMessage(error, "資產資訊更新失敗。"), "error");
    }
  }

  async function handleFilesSelected(files: File[]) {
    const rejectedType = files.some(
      (file) => !STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type),
    );
    const rejectedSize = files.some(
      (file) => file.size > STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const accepted = files.filter(
      (file) =>
        STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES.includes(file.type) &&
        file.size <= STORYTELLER_IMAGE_PAGE_MAX_BYTES,
    );
    const images = accepted.slice(0, STORYTELLER_IMAGE_PAGE_MAX_COUNT);
    const overCount = accepted.length > STORYTELLER_IMAGE_PAGE_MAX_COUNT;
    if (images.length === 0) {
      onNotify("請選擇圖片檔案。", "error");
      return;
    }
    if (rejectedType || rejectedSize || overCount) {
      const reasons = [
        rejectedType && "只接受 JPEG／PNG／WebP／GIF 圖片檔",
        rejectedSize && `單張檔案不能超過 ${maxMB}MB`,
        overCount && `單次最多 ${STORYTELLER_IMAGE_PAGE_MAX_COUNT} 張`,
      ].filter(Boolean);
      onNotify(`部分檔案未上傳：${reasons.join("、")}`, "error");
    }

    const newItems = images.map((file) => ({
      id: uploadItemId(file),
      file,
      previewUrl: URL.createObjectURL(file),
      metadata: emptyMetadata(),
      metadataOpen: false,
      metadataStatus: "idle" as MetadataStatus,
      savedMetadataSignature: "",
    }));
    updateItems((current) => [...current, ...newItems]);
    setUploadProgress((current) => ({
      ...current,
      ...Object.fromEntries(
        newItems.map((item) => [
          item.id,
          { name: item.file.name, loaded: 0, total: item.file.size },
        ]),
      ),
    }));
    setUploadPhase("uploading");
    try {
      const uploaded = await uploadAssets.mutateAsync({
        files: images,
        collectionId,
        onProgress: (index, loaded, total) => {
          const item = newItems[index];
          if (!item) {
            return;
          }
          setUploadProgress((current) => ({
            ...current,
            [item.id]: { name: item.file.name, loaded, total },
          }));
        },
      });
      updateItems((current) =>
        current.map((item) => {
          const uploadIndex = newItems.findIndex(
            (newItem) => newItem.id === item.id,
          );
          return uploadIndex >= 0 && uploaded[uploadIndex]
            ? { ...item, asset: uploaded[uploadIndex] }
            : item;
        }),
      );
      for (const [index, asset] of uploaded.entries()) {
        const item = itemsRef.current.find(
          (current) => current.id === newItems[index]?.id,
        );
        if (item) {
          await saveMetadata(item.id, asset, item.metadata);
        }
      }
      onNotify(`已上傳 ${uploaded.length} 個資產。`, "success");
      onUploaded(uploaded);
    } catch (error) {
      onNotify(errorMessage(error, "資產上傳失敗，請稍後再試。"), "error");
    } finally {
      setUploadPhase("idle");
    }
  }

  function requestClose() {
    if (uploadPhase === "uploading") {
      onNotify("圖片上傳中，請等完成後再關閉。", "info");
      return;
    }
    clearItems();
    onClose();
  }

  function updateMetadata(
    itemId: string,
    key: keyof UploadMetadata,
    value: string,
  ) {
    updateItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              metadata: { ...item.metadata, [key]: value },
              metadataStatus:
                item.asset && item.metadataStatus === "saved"
                  ? "idle"
                  : item.metadataStatus,
            }
          : item,
      ),
    );
  }

  function saveMetadataOnBlur(itemId: string) {
    const item = itemsRef.current.find((current) => current.id === itemId);
    if (
      !item ||
      !item.asset ||
      !hasMetadataInput(item.metadata) ||
      item.savedMetadataSignature === metadataSignature(item.metadata)
    ) {
      return;
    }
    void saveMetadata(item.id, item.asset, item.metadata);
  }

  const progressRows = Object.values(uploadProgress);
  const progressLoaded = progressRows.reduce((sum, row) => sum + row.loaded, 0);
  const progressTotal = progressRows.reduce((sum, row) => sum + row.total, 0);
  const overallProgress =
    progressTotal > 0 ? Math.round((progressLoaded / progressTotal) * 100) : 0;
  const uploadedCount = items.filter((item) => item.asset).length;
  const allUploaded =
    items.length > 0 &&
    uploadedCount === items.length &&
    uploadPhase === "idle";

  return (
    <Drawer anchor="right" open={open} onClose={requestClose}>
      <Box
        sx={{
          width: { xs: "100vw", sm: 720 },
          maxWidth: "100vw",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="h6" fontWeight={800}>
            上傳圖像資產
          </Typography>
          <IconButton aria-label="關閉上傳抽屜" onClick={requestClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflow: "auto" }}>
          <StorytellerAssetDropzone
            accept={STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES}
            disabled={uploadPhase === "uploading"}
            hint={
              <>
                拖曳圖片到這裡，或點擊選擇檔案（可一次選多張，支援批次上傳）
                <br />
                支援 JPEG／PNG／WebP／GIF，單張檔案 {maxMB}MB 內，一次最多{" "}
                {STORYTELLER_IMAGE_PAGE_MAX_COUNT} 張
              </>
            }
            onFilesSelected={handleFilesSelected}
          />

          {items.length > 0 && (
            <Stack spacing={1.5}>
              {items.map((item) => (
                <StorytellerAssetUploadDrawerItem
                  key={item.id}
                  item={item}
                  progress={uploadProgress[item.id]}
                  onToggleMetadata={(itemId) =>
                    updateItems((current) =>
                      current.map((currentItem) =>
                        currentItem.id === itemId
                          ? {
                              ...currentItem,
                              metadataOpen: !currentItem.metadataOpen,
                            }
                          : currentItem,
                      ),
                    )
                  }
                  onMetadataChange={updateMetadata}
                  onMetadataBlur={saveMetadataOnBlur}
                />
              ))}
            </Stack>
          )}
        </Stack>

        <Stack
          spacing={1}
          sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography fontWeight={800}>
              {uploadPhase === "uploading"
                ? "圖片上傳中"
                : allUploaded
                  ? `已上傳 ${uploadedCount} 張`
                  : "尚未選擇圖片"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {overallProgress}%
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={overallProgress} />
        </Stack>
      </Box>
    </Drawer>
  );
}
