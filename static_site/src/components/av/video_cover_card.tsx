import type { Video } from "@/types/av.ts";
import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { VideoMarkBadge } from "@/components/joyu/marks/VideoMarkBadge.tsx";
import { UpcomingBadge } from "@/components/av/upcoming_badge.tsx";

/**
 * 直式封面卡片：封面＋番號＋兩行標題，相關作品等橫向列表用。
 * 預約作品（即將發售）在封面右上角標「即將發售・11/20」
 */
export function VideoCoverCard({
  video,
  titleLines = 2,
}: {
  video: Video;
  /** 標題最多顯示幾行；可依斷點給（一屏版首頁：手機 0＝只留番號、PC 1 行） */
  titleLines?: number | { xs: number; md: number };
}) {
  const code = video.maker_no || video.no.toUpperCase();
  return (
    <Box
      component={Link}
      to={joyuPath(`video/${encodeURIComponent(video.maker_no || video.no)}`)}
      sx={{
        color: "inherit",
        textAlign: "left",
        textDecoration: "none",
        "&:hover img": { transform: "translateY(-2px)" },
      }}
    >
      {/* 包一層 relative 給片單小標定位 */}
      <Box sx={{ position: "relative" }}>
        <AvCoverImage
          src={video.thumb}
          alt={video.title}
          loading="lazy"
          sx={{
            aspectRatio: AV_COVER_ASPECT_RATIO,
            bgcolor: "grey.200",
            borderRadius: 1,
            display: "block",
            objectFit: "cover",
            transition: "transform 160ms ease",
            width: "100%",
          }}
        />
        <VideoMarkBadge videoNo={video.no} />
        <UpcomingBadge video={video} />
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.75 }}>
        {code}
      </Typography>
      <Typography
        sx={{
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: titleLines,
          // 行數 0 就整個不顯示
          display:
            typeof titleLines === "number"
              ? titleLines > 0
                ? "-webkit-box"
                : "none"
              : {
                  xs: titleLines.xs > 0 ? "-webkit-box" : "none",
                  md: titleLines.md > 0 ? "-webkit-box" : "none",
                },
          fontSize: 12,
          overflow: "hidden",
        }}
        title={video.title}
      >
        {video.title}
      </Typography>
    </Box>
  );
}
