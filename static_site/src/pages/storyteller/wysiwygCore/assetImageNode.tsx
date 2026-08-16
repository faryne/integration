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
import { useState } from "react";
import { useStorytellerAsset } from "@/apis/storyteller.ts";
import { assetImageFrameSx } from "./assetImageLayout";
import { DEFAULT_ASSET_IMAGE_LAYOUT } from "./whitelist";

function AssetImageView({
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
  const layout = node.attrs.layout;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [altDraft, setAltDraft] = useState(alt);
  const assetQuery = useStorytellerAsset(projectPublicId, publicId);
  const asset = assetQuery.data;
  const previewUrl = asset?.preview_url || src;
  const title = alt || asset?.title || asset?.original_filename || publicId;

  function openDialog() {
    setAltDraft(alt);
    setDialogOpen(true);
  }

  function saveAlt() {
    updateAttributes({ alt: altDraft.trim() });
    setDialogOpen(false);
  }

  return (
    <NodeViewWrapper as="span">
      <Paper
        component="span"
        variant="outlined"
        contentEditable={false}
        data-drag-handle
        data-asset-layout={layout}
        onDoubleClick={openDialog}
        sx={{
          ...assetImageFrameSx(layout),
          borderColor: selected ? "primary.main" : "divider",
          boxShadow: selected ? 1 : 0,
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
              maxHeight: 360,
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
            <Tooltip title="調整資產文字">
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
        <DialogTitle>調整資產文字</DialogTitle>
        <DialogContent>
          <TextField
            label="替代文字"
            value={altDraft}
            onChange={(event) => setAltDraft(event.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveAlt}>
            套用
          </Button>
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
      projectPublicId: { default: "" },
      layout: { default: DEFAULT_ASSET_IMAGE_LAYOUT },
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
