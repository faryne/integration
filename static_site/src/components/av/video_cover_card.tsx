import type { Video } from "@/types/av.ts";
import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { VideoMarkBadge } from "@/components/joyu/marks/VideoMarkBadge.tsx";
import { isUpcoming, shortDate } from "@/helpers/upcoming.ts";

/**
 * 直式封面卡片：封面＋番號＋兩行標題，相關作品等橫向列表用。
 * 預約作品（即將發售）在封面右上角標「即將發售・11/20」
 */
export function VideoCoverCard({ video }: { video: Video }) {
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
        {isUpcoming(video) && (
          <Box
            component="span"
            sx={{
              bgcolor: "primary.main",
              borderRadius: 0.75,
              color: "primary.contrastText",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.6,
              pointerEvents: "none",
              position: "absolute",
              px: 0.75,
              right: 6,
              top: 6,
            }}
          >
            即將發售・{shortDate(video.vod_date)}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.75 }}>
        {code}
      </Typography>
      <Typography
        sx={{
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          display: "-webkit-box",
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
