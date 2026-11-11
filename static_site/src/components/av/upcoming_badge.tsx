import { Box } from "@mui/material";

import { isUpcoming, shortDate } from "@/helpers/upcoming.ts";
import type { Video } from "@/types/av.ts";

/** 影片卡片封面右上角的「即將發售・11/20」；已配信的不顯示。父層要是 position: relative */
export function UpcomingBadge({ video }: { video: Video }) {
  if (!isUpcoming(video)) return null;
  return (
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
  );
}
