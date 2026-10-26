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
import type { VideoSyncResult } from "@/apis/av/video_sync.ts";
import { VideoRelated } from "@/components/av/video_related.tsx";
import { VideoSyncButton } from "@/components/av/video_sync_button.tsx";
import { ImageViewer } from "@/components/common/ImageViewer.tsx";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";

export interface IVideoDetail {
  video?: Video;
  // 「同步資料」成功取得官方番號後，由頁面換到新網址並重新查詢
  onSynced?: (result: VideoSyncResult) => void;
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
  // 沒有官方番號的舊資料顯示 DMM 內部番號
  const displayCode = displayMakerNo || video?.no.toUpperCase() || "";

  useTitle(video?.title ?? "");
  useBreadcrumbTail(video ? `${displayCode} ${video.title}` : undefined);

  const chipClick = (s: string, keyPrefix: string) => {
    if (keyPrefix === "actress") {
      navigate("/av/actress?name=" + encodeURIComponent(s));
      return;
    }
    // keyPrefix 與搜尋頁的精確篩選參數同名（見 data/avVideoFilters.ts）
    navigate(`/av/video?${keyPrefix}=${encodeURIComponent(s)}`);
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
    items.map((o) => (
      <Chip
        key={`${keyPrefix}-${o}`}
        label={o}
        clickable
        onClick={() => chipClick(o, keyPrefix)}
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
    ));

  // 沒資料的欄位整列不顯示
  const infoRows = [
    { label: "發售商", items: makers, keyPrefix: "maker" },
    { label: "品牌", items: labels, keyPrefix: "label" },
    { label: "系列", items: series, keyPrefix: "series" },
    { label: "出演", items: actresses, keyPrefix: "actress" },
    { label: "監督", items: directors, keyPrefix: "director" },
    { label: "標籤", items: tags, keyPrefix: "tag" },
  ].filter((row) => row.items.length > 0);

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
        {/* 封面是直式（約 1429×1944），照原比例顯示不裁切；手機限制高度並置中 */}
        <Box
          sx={{
            alignSelf: "start",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "grey.100",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.12)",
            justifySelf: { xs: "center", md: "stretch" },
            maxWidth: "100%",
          }}
        >
          <Box
            component="img"
            src={video.thumb}
            alt={video.title}
            sx={{
              display: "block",
              height: "auto",
              maxHeight: { xs: "60vh", md: "none" },
              maxWidth: "100%",
              objectFit: "contain",
              width: { xs: "auto", md: "100%" },
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
              {displayCode && (
                <Chip
                  label={displayCode}
                  size="small"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 700,
                    letterSpacing: 0,
                  }}
                />
              )}
              {[
                video.vod_date && `配信日 ${video.vod_date}`,
                video.publish_date && `發售日 ${video.publish_date}`,
                video.duration ? `${video.duration} 分鐘` : "",
              ]
                .filter(Boolean)
                .map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    sx={{ borderRadius: 1 }}
                    variant="outlined"
                  />
                ))}
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.25rem", md: "1.75rem" },
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

          <Box>
            {video.maker_no ? (
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
            ) : (
              <VideoSyncButton
                no={video.no}
                onSynced={(r) => props.onSynced?.(r)}
              />
            )}
          </Box>
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
                gridTemplateColumns: { xs: "64px 1fr", sm: "96px 1fr" },
                gap: { xs: 1, sm: 2 },
                alignItems: "start",
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

      <VideoRelated video={video} />
    </Stack>
  );
}
