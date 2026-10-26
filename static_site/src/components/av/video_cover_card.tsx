import type { Video } from "@/types/av.ts";
import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";

/** 直式封面卡片：封面＋番號＋兩行標題，相關作品等橫向列表用 */
export function VideoCoverCard({ video }: { video: Video }) {
  const code = video.maker_no || video.no.toUpperCase();
  return (
    <Box
      component={Link}
      to={`/av/video/${encodeURIComponent(video.maker_no || video.no)}`}
      sx={{
        color: "inherit",
        flex: { xs: "0 0 110px", md: "0 0 132px" },
        textAlign: "left",
        textDecoration: "none",
        "&:hover img": { transform: "translateY(-2px)" },
      }}
    >
      <Box
        component="img"
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
