import type { Video } from "@/types/av.ts";
import { Box, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";

// 詳細頁網址優先用官方番號，沒有就用 DMM 內部番號
const videoDetailId = (video: Video) =>
  video.maker_no?.trim() || video.no?.trim() || undefined;

const chipSx = { borderRadius: 1, fontSize: "0.72rem" };

/**
 * 影片搜尋結果卡片：直式封面＋番號／配信日＋兩行標題＋出演。
 * 搜尋頁與女優頁共用，封面走 AvCoverImage（舊作自動換高解析）
 */
export function VideoResultCard({ video }: { video: Video }) {
  const navigate = useNavigate();
  const detailId = videoDetailId(video);
  const makerNo = video.maker_no?.trim();

  return (
    <Box
      component="button"
      disabled={!detailId}
      onClick={() => detailId && navigate(`/av/video/${detailId}`)}
      sx={{
        appearance: "none",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        cursor: detailId ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        p: 0,
        textAlign: "left",
        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        width: "100%",
        "&:focus-visible": {
          borderColor: "primary.main",
          boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.28)",
          outline: 0,
        },
        "&:hover": detailId
          ? {
              borderColor: "rgba(25, 118, 210, 0.42)",
              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.13)",
              transform: "translateY(-2px)",
            }
          : undefined,
      }}
    >
      <Box
        sx={{
          aspectRatio: AV_COVER_ASPECT_RATIO,
          bgcolor: "grey.100",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <AvCoverImage
          src={video.thumb}
          alt={video.title}
          loading="lazy"
          sx={{
            display: "block",
            height: "100%",
            objectFit: "cover",
            width: "100%",
          }}
        />
      </Box>
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {makerNo && (
            <Chip
              label={makerNo}
              size="small"
              sx={{ ...chipSx, fontWeight: 700 }}
            />
          )}
          {video.vod_date && (
            <Chip
              label={video.vod_date}
              size="small"
              sx={chipSx}
              variant="outlined"
            />
          )}
        </Stack>
        <Typography
          sx={{
            color: "text.primary",
            display: "-webkit-box",
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.35,
            minHeight: "2.7em",
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
          variant="body1"
        >
          {video.title}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            minHeight: "1.43em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          variant="body2"
        >
          {video.actresses.filter((a) => a !== "").join(" / ") ||
            "未登錄出演資訊"}
        </Typography>
      </Stack>
    </Box>
  );
}

/** 載入中的佔位卡片，比例與 VideoResultCard 一致 */
export function VideoResultSkeleton() {
  return (
    <Stack spacing={1}>
      <Skeleton
        sx={{
          aspectRatio: AV_COVER_ASPECT_RATIO,
          borderRadius: 2,
          height: "auto",
        }}
        variant="rounded"
      />
      <Skeleton height={28} variant="rounded" />
      <Skeleton height={22} width="70%" variant="rounded" />
    </Stack>
  );
}
