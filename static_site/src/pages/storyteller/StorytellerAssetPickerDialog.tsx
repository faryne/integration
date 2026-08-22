import ImageIcon from "@mui/icons-material/Image";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useStorytellerAssets } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { storytellerAssetTitle } from "@/pages/storyteller/storytellerAssetMarkdown.ts";
import type { StorytellerAsset } from "@/types/storyteller.ts";

const pickerPageSize = 12;

interface StorytellerAssetPickerDialogProps {
  open: boolean;
  projectPublicId?: string;
  title?: string;
  onClose: () => void;
  onSelect: (asset: StorytellerAsset) => void;
}

export function StorytellerAssetPickerDialog({
  open,
  projectPublicId,
  title = "選擇資產",
  onClose,
  onSelect,
}: StorytellerAssetPickerDialogProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const assetsQuery = useStorytellerAssets(
    open ? projectPublicId : undefined,
    page,
    pickerPageSize,
    keyword,
  );
  const assets = assetsQuery.data?.assets ?? [];
  const totalPages = Math.ceil(
    (assetsQuery.data?.total_count ?? 0) / pickerPageSize,
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            size="small"
            label="搜尋資產"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
          {assetsQuery.isLoading ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
              <Typography color="text.secondary">正在載入資產...</Typography>
            </Paper>
          ) : assets.length === 0 ? (
            <CustomEmptyState
              icon={<ImageIcon />}
              title="沒有可用資產"
              description="請先在資產集上傳圖片。"
              action={
                projectPublicId ? (
                  <Button
                    component={RouterLink}
                    to={steamloomPath(`my/workspace/${projectPublicId}/assets`)}
                    target="_blank"
                    rel="noopener"
                    size="small"
                    variant="outlined"
                  >
                    前往資產集上傳
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Grid container spacing={1.5}>
              {assets.map((asset) => (
                <Grid key={asset.public_id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    variant="outlined"
                    onClick={() => onSelect(asset)}
                    sx={{
                      borderRadius: 1,
                      overflow: "hidden",
                      cursor: "pointer",
                      height: "100%",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Box
                      component="img"
                      src={asset.preview_url}
                      alt={asset.alt_text || storytellerAssetTitle(asset)}
                      sx={{
                        width: "100%",
                        aspectRatio: "16 / 10",
                        objectFit: "cover",
                        bgcolor: "background.default",
                      }}
                    />
                    <Stack spacing={0.75} sx={{ p: 1.25 }}>
                      <Typography
                        fontWeight={800}
                        sx={{
                          overflowWrap: "anywhere",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        }}
                      >
                        {storytellerAssetTitle(asset)}
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        <Chip size="small" label={asset.mime_type} />
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
          {totalPages > 1 && (
            <Stack alignItems="center">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
              />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
}
