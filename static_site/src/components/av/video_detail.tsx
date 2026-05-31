import type { Video } from "@/types/av.ts";
import {
  Button,
  Chip,
  Stack,
  Typography,
  Box,
  Divider,
  Dialog,
  IconButton,
  Skeleton,
} from "@mui/material";
import { useTitle } from "@/helpers/title.tsx";
import { useNavigate } from "react-router-dom";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useState } from "react";

export interface IVideoDetail {
  video?: Video;
}

export function VideoDetail(props: IVideoDetail) {
  const navigate = useNavigate();
  const video = props.video || null;
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const labels = video ? video.labels.filter((l) => l !== "") : [];
  const actresses = video ? video.actresses.filter((a) => a !== "") : [];
  const makers = video ? video?.makers.filter((m) => m !== "") : [];
  const series = video ? video.series.filter((s) => s !== "") : [];
  const directors = video ? video?.directors.filter((d) => d !== "") : [];
  const tags = video ? video.tags.filter((t) => t !== "") : [];

  useTitle(video?.title ?? "");

  const chipClick = (s: string) => {
    navigate("/av/video?keyword=" + encodeURIComponent(s));
  };

  const imageCount = video?.images.length ?? 0;
  const selectedImage =
    selectedImageIndex !== null
      ? (video?.images[selectedImageIndex] ?? null)
      : null;

  const closeLightbox = () => {
    setSelectedImageIndex(null);
  };

  const switchImage = (direction: -1 | 1) => {
    if (imageCount === 0) {
      return;
    }

    setSelectedImageIndex((current) => {
      if (current === null) {
        return current;
      }

      return (current + direction + imageCount) % imageCount;
    });
  };

  const renderChips = (items: string[], keyPrefix: string) =>
    items.length > 0 ? (
      items.map((o) => (
        <Chip
          key={`${keyPrefix}-${o}`}
          label={o}
          clickable
          onClick={() => chipClick(o)}
          sx={{
            borderRadius: 1.5,
            bgcolor: "rgba(25, 118, 210, 0.08)",
            borderColor: "rgba(25, 118, 210, 0.22)",
            color: "primary.dark",
            fontWeight: 500,
            "&:hover": {
              bgcolor: "rgba(25, 118, 210, 0.14)",
            },
          }}
          variant="outlined"
        />
      ))
    ) : (
      <Typography color="text.secondary" variant="body2">
        -
      </Typography>
    );

  const infoRows = [
    { label: "發售商", items: makers, keyPrefix: "maker" },
    { label: "品牌", items: labels, keyPrefix: "label" },
    { label: "系列", items: series, keyPrefix: "series" },
    { label: "出演", items: actresses, keyPrefix: "actress" },
    { label: "監督", items: directors, keyPrefix: "director" },
    { label: "標籤", items: tags, keyPrefix: "tag" },
  ];

  if (!video) {
    return (
      <Stack spacing={3}>
        <Skeleton height={360} sx={{ borderRadius: 2 }} variant="rounded" />
        <Skeleton height={42} sx={{ maxWidth: 720 }} variant="rounded" />
        <Skeleton height={160} variant="rounded" />
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 420px) 1fr" },
          gap: { xs: 3, md: 4 },
          alignItems: "stretch",
        }}
      >
        <Box
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "grey.100",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
          }}
        >
          <Box
            component="img"
            src={video.thumb}
            alt={video.title}
            sx={{
              aspectRatio: "16 / 10",
              display: "block",
              height: "100%",
              maxHeight: { xs: 320, md: 520 },
              objectFit: "cover",
              width: "100%",
            }}
          />
        </Box>

        <Stack
          justifyContent="space-between"
          spacing={3}
          sx={{
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
            py: { xs: 2.5, md: 3.5 },
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip
                label={video.maker_no ?? video.no}
                size="small"
                sx={{
                  borderRadius: 1,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
              />
              {video.vod_date && (
                <Chip
                  label={`發售日 ${video.vod_date}`}
                  size="small"
                  sx={{ borderRadius: 1 }}
                  variant="outlined"
                />
              )}
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.75rem", md: "2.5rem" },
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1.2,
                textAlign: "left",
              }}
              variant="h3"
            >
              {video.title}
            </Typography>
          </Stack>

          {video.maker_no && (
            <Box>
              <Button
                endIcon={<OpenInNewIcon />}
                onClick={() =>
                  window.open(
                    `https://missav.ws/${video.maker_no}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                startIcon={<PlayCircleOutlineIcon />}
                sx={{ borderRadius: 1.5, px: 2 }}
                variant="contained"
              >
                MissAV
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {infoRows.map((row, index) => (
          <Box key={row.keyPrefix}>
            {index > 0 && <Divider />}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "96px 1fr" },
                gap: { xs: 1, sm: 2 },
                px: { xs: 2, md: 2.5 },
                py: 1.75,
                textAlign: "left",
              }}
            >
              <Typography color="text.secondary" fontWeight={700}>
                {row.label}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {renderChips(row.items, row.keyPrefix)}
              </Stack>
            </Box>
          </Box>
        ))}
      </Box>

      {video.images.length > 0 && (
        <Stack spacing={2} sx={{ textAlign: "left" }}>
          <Typography
            component="h2"
            sx={{ fontWeight: 800, letterSpacing: 0 }}
            variant="h5"
          >
            圖片預覽
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
                md: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            {video.images.map((image, index) => (
              <Box
                aria-label={`開啟圖片 ${index + 1}`}
                component="button"
                key={`${image.thumb}-${index}`}
                onClick={() => setSelectedImageIndex(index)}
                sx={{
                  appearance: "none",
                  aspectRatio: "16 / 10",
                  bgcolor: "grey.100",
                  border: 0,
                  borderRadius: 1.5,
                  display: "block",
                  cursor: "zoom-in",
                  p: 0,
                  overflow: "hidden",
                  transition:
                    "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
                  width: "100%",
                  "&:focus-visible": {
                    boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.34)",
                    outline: 0,
                  },
                  "&:hover": {
                    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
                    filter: "saturate(1.08)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Box
                  component="img"
                  src={image.thumb}
                  alt={`${video.title} ${index + 1}`}
                  loading="lazy"
                  sx={{
                    display: "block",
                    height: "100%",
                    objectFit: "cover",
                    width: "100%",
                  }}
                />
              </Box>
            ))}
          </Box>
        </Stack>
      )}

      <Dialog
        fullWidth
        maxWidth="lg"
        onClose={closeLightbox}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            switchImage(-1);
          }
          if (event.key === "ArrowRight") {
            switchImage(1);
          }
        }}
        open={selectedImage !== null}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "grey.950",
              backgroundImage: "none",
              borderRadius: 2,
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
              m: { xs: 1.5, sm: 3 },
              maxHeight: "calc(100% - 32px)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Box sx={{ position: "relative", bgcolor: "grey.950" }}>
          <Box
            sx={{
              alignItems: "center",
              background: "linear-gradient(rgba(0, 0, 0, 0.62), transparent)",
              color: "common.white",
              display: "flex",
              justifyContent: "space-between",
              left: 0,
              px: { xs: 1.5, sm: 2 },
              py: 1.5,
              position: "absolute",
              right: 0,
              top: 0,
              zIndex: 1,
            }}
          >
            <Typography fontWeight={700} variant="body2">
              {selectedImageIndex !== null ? selectedImageIndex + 1 : 0}/
              {imageCount} 張圖片
            </Typography>
          </Box>
          <IconButton
            aria-label="關閉圖片預覽"
            onClick={closeLightbox}
            sx={{
              bgcolor: "rgba(0, 0, 0, 0.48)",
              color: "common.white",
              position: "absolute",
              right: 12,
              top: 12,
              zIndex: 1,
              "&:hover": {
                bgcolor: "rgba(0, 0, 0, 0.68)",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          {imageCount > 1 && (
            <>
              <IconButton
                aria-label="上一張圖片"
                onClick={() => switchImage(-1)}
                sx={{
                  bgcolor: "rgba(0, 0, 0, 0.48)",
                  color: "common.white",
                  left: { xs: 8, sm: 16 },
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                  "&:hover": {
                    bgcolor: "rgba(0, 0, 0, 0.68)",
                  },
                }}
              >
                <ArrowBackIosNewIcon />
              </IconButton>
              <IconButton
                aria-label="下一張圖片"
                onClick={() => switchImage(1)}
                sx={{
                  bgcolor: "rgba(0, 0, 0, 0.48)",
                  color: "common.white",
                  position: "absolute",
                  right: { xs: 8, sm: 16 },
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                  "&:hover": {
                    bgcolor: "rgba(0, 0, 0, 0.68)",
                  },
                }}
              >
                <ArrowForwardIosIcon />
              </IconButton>
            </>
          )}
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage.preview || selectedImage.thumb}
              alt={video.title}
              sx={{
                display: "block",
                maxHeight: "calc(100vh - 96px)",
                objectFit: "contain",
                width: "100%",
              }}
            />
          )}
        </Box>
      </Dialog>
    </Stack>
  );
}
