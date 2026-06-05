import type { Video } from "@/types/av.ts";
import {
  Button,
  Chip,
  Stack,
  Typography,
  Box,
  Divider,
  Skeleton,
} from "@mui/material";
import { useTitle } from "@/helpers/title.tsx";
import { useNavigate } from "react-router-dom";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { useMemo } from "react";
import { ImageViewer } from "@/components/common/ImageViewer.tsx";

export interface IVideoDetail {
  video?: Video;
}

export function VideoDetail(props: IVideoDetail) {
  const navigate = useNavigate();
  const video = props.video || null;
  const labels = video ? video.labels.filter((l) => l !== "") : [];
  const actresses = video ? video.actresses.filter((a) => a !== "") : [];
  const makers = video ? video?.makers.filter((m) => m !== "") : [];
  const series = video ? video.series.filter((s) => s !== "") : [];
  const directors = video ? video?.directors.filter((d) => d !== "") : [];
  const tags = video ? video.tags.filter((t) => t !== "") : [];
  const displayMakerNo = video?.maker_no?.trim() ?? "";

  useTitle(video?.title ?? "");

  const chipClick = (s: string) => {
    navigate("/av/video?keyword=" + encodeURIComponent(s));
  };

  const previewPhotos = useMemo(
    () =>
      (video?.images ?? []).map((image) => ({
        thumb: image.thumb,
        url: image.preview || image.thumb,
      })),
    [video?.images],
  );

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
              {displayMakerNo && (
                <Chip
                  label={displayMakerNo}
                  size="small"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 700,
                    letterSpacing: 0,
                  }}
                />
              )}
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
          <ImageViewer photos={previewPhotos} title={video.title} />
        </Stack>
      )}
    </Stack>
  );
}
