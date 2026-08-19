import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useState } from "react";
import { useStorytellerAsset } from "@/apis/storyteller.ts";
import {
  ASSET_IMAGE_LAYOUT_OPTIONS,
  ASSET_IMAGE_SIZE_OPTIONS,
  assetImageFrameSx,
} from "./assetImageLayout";
import {
  OPEN_ASSET_IMAGE_SETTINGS_EVENT,
  type OpenAssetImageSettingsEventDetail,
} from "./assetImageEvents";
import {
  DEFAULT_ASSET_IMAGE_LAYOUT,
  DEFAULT_ASSET_IMAGE_SIZE,
  normalizeAssetImageLayout,
  normalizeAssetImageSize,
  type AssetImageLayoutValue,
  type AssetImageSizeValue,
} from "./whitelist";

function AssetImageView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const publicId = (node.attrs.publicId as string | undefined) ?? "";
  const src = (node.attrs.src as string | undefined) ?? "";
  const projectPublicId =
    (node.attrs.projectPublicId as string | undefined) ?? "";
  const alt = (node.attrs.alt as string | undefined) ?? "";
  const caption = (node.attrs.caption as string | undefined) ?? "";
  const layout = normalizeAssetImageLayout(node.attrs.layout);
  const size = normalizeAssetImageSize(node.attrs.size);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [altDraft, setAltDraft] = useState(alt);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [layoutDraft, setLayoutDraft] =
    useState<AssetImageLayoutValue>(layout);
  const [sizeDraft, setSizeDraft] = useState<AssetImageSizeValue>(size);
  const assetQuery = useStorytellerAsset(projectPublicId, publicId);
  const asset = assetQuery.data;
  const previewUrl = asset?.preview_url || src;
  const title = alt || asset?.title || asset?.original_filename || publicId;

  function openDialog() {
    setAltDraft(alt);
    setCaptionDraft(caption);
    setLayoutDraft(layout);
    setSizeDraft(size);
    setDialogOpen(true);
  }

  function saveSettings() {
    updateAttributes({
      alt: altDraft.trim(),
      caption: captionDraft.trim(),
      layout: layoutDraft,
      size: sizeDraft,
    });
    setDialogOpen(false);
  }

  function deleteAsset() {
    setDialogOpen(false);
    deleteNode();
  }

  useEffect(() => {
    const root = editor.view.dom;
    const openSettings = (event: Event) => {
      const detail = (event as CustomEvent<OpenAssetImageSettingsEventDetail>)
        .detail;
      if (typeof getPos === "function" && getPos() === detail?.pos) {
        setAltDraft(alt);
        setCaptionDraft(caption);
        setLayoutDraft(layout);
        setSizeDraft(size);
        setDialogOpen(true);
      }
    };
    root.addEventListener(OPEN_ASSET_IMAGE_SETTINGS_EVENT, openSettings);
    return () => {
      root.removeEventListener(OPEN_ASSET_IMAGE_SETTINGS_EVENT, openSettings);
    };
  }, [alt, caption, editor.view.dom, getPos, layout, size]);

  return (
    <NodeViewWrapper as="span">
      <Paper
        component="span"
        variant="outlined"
        contentEditable={false}
        data-drag-handle
        data-asset-layout={layout}
        data-asset-size={size}
        onDoubleClick={openDialog}
        sx={{
          ...assetImageFrameSx(layout, size),
          // 選取狀態（NodeSelection，例如點圖片、或已知 Bug 記錄第 14 項的
          // Backspace 先選取）原本只換邊框顏色＋一級陰影，太不明顯，使用者反映
          // 看不出來焦點在圖片上。改成邊框加粗＋外面再加一圈用 selection token
          // 的 outline「光暈」，跟背景色系無關，任何色系/明暗模式下都能一眼看到。
          borderColor: selected
            ? "var(--storyteller-selection, #e6bd76)"
            : "divider",
          borderWidth: selected ? 2 : 1,
          outline: selected
            ? "3px solid var(--storyteller-selection, #e6bd76)"
            : "none",
          outlineOffset: 3,
          boxShadow: selected ? 3 : 0,
          transition:
            "border-color 0.15s ease, outline-color 0.15s ease, box-shadow 0.15s ease",
          cursor: "grab",
        }}
      >
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt={title}
            sx={{
              width: "100%",
              // 跟 StorytellerWysiwygMarkdown.tsx（Reader）的圖片 maxHeight 對齊——
              // 原本編輯器寫死 360，Reader 是 { xs: 420, md: 640 }，同一張直式構圖的
              // 圖片在兩邊顯示的實際高度差快兩倍，連帶讓文繞圖的段落數量也不一樣，
              // 編輯區看到的排版跟讀者實際看到的不一致（2026-08-17 使用者截圖比對
              // 發現）。閱讀頁才是給讀者看的最終呈現，編輯器跟著閱讀頁的數值走。
              maxHeight: { xs: 420, md: 640 },
              objectFit: "contain",
              display: "block",
              bgcolor: "background.default",
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              p: 2,
              minHeight: 120,
              display: "grid",
              placeItems: "center",
              bgcolor: "background.default",
            }}
          >
            <Typography component="span" color="text.secondary">
              {assetQuery.isLoading ? "正在載入資產..." : "找不到資產預覽"}
            </Typography>
          </Box>
        )}
        {caption ? (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{
              display: "block",
              px: 1.25,
              pt: 0.75,
              fontStyle: "italic",
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            {caption}
          </Typography>
        ) : null}
        <Stack
          component="span"
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.25, py: 0.75 }}
        >
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ overflowWrap: "anywhere" }}
          >
            {title}
          </Typography>
          <Stack component="span" direction="row" spacing={0.5}>
            <Tooltip title="圖片設定">
              <IconButton size="small" onClick={openDialog}>
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="移除資產">
              <IconButton size="small" color="error" onClick={deleteNode}>
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>圖片設定</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="替代文字"
              helperText="給無障礙輔助工具／SEO 用，不會顯示在畫面上"
              value={altDraft}
              onChange={(event) => setAltDraft(event.target.value)}
              fullWidth
            />
            <TextField
              label="圖說"
              helperText="顯示給讀者看的說明文字，留空則不顯示"
              value={captionDraft}
              onChange={(event) => setCaptionDraft(event.target.value)}
              fullWidth
              multiline
              maxRows={3}
            />
            <TextField
              select
              label="版面"
              value={layoutDraft}
              onChange={(event) =>
                setLayoutDraft(
                  normalizeAssetImageLayout(event.target.value),
                )
              }
              fullWidth
            >
              {ASSET_IMAGE_LAYOUT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="尺寸"
              value={sizeDraft}
              onChange={(event) =>
                setSizeDraft(normalizeAssetImageSize(event.target.value))
              }
              fullWidth
            >
              {ASSET_IMAGE_SIZE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button color="error" onClick={deleteAsset}>
            刪除圖片
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setDialogOpen(false)}>取消</Button>
            <Button variant="contained" onClick={saveSettings}>
              套用
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </NodeViewWrapper>
  );
}

export const AssetImage = Node.create({
  name: "assetImage",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      publicId: { default: "" },
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      projectPublicId: { default: "" },
      layout: { default: DEFAULT_ASSET_IMAGE_LAYOUT },
      size: { default: DEFAULT_ASSET_IMAGE_SIZE },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-asset-image": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssetImageView);
  },
});
