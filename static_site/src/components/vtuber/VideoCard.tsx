import { Box, ButtonBase, Typography } from "@mui/material";

import { HighlightText } from "@/components/common/HighlightText.tsx";
import { relativeDayName, taipeiTime } from "@/components/vtuber/format.ts";
import type { VtuberVideo } from "@/types/vtubers.ts";

const BADGES = {
  live: { label: "LIVE", bgcolor: "error.main" },
  upcoming: { label: "即將直播", bgcolor: "info.main" },
} as const;

interface VideoCardProps {
  video: VtuberVideo;
  shorts?: boolean;
  keyword?: string; // 影片搜尋時標出標題裡的關鍵字
  onClick: () => void;
}

/** 影片卡片：縮圖（搜尋結果帶 LIVE／即將直播標籤）＋兩行標題＋上傳日期 */
export function VideoCard({ video, shorts, keyword, onClick }: VideoCardProps) {
  const published = taipeiTime(video.published_at);
  const badge = video.live_broadcast_content
    ? BADGES[video.live_broadcast_content]
    : null;
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ display: "block", textAlign: "left", borderRadius: 1 }}
    >
      {/* YouTube 給的短片縮圖也是 16:9（直式內容在中間），放進 9:16 框置中裁切剛好露出內容 */}
      <Box
        sx={{
          position: "relative",
          aspectRatio: shorts ? "9 / 16" : "16 / 9",
          borderRadius: 1,
          bgcolor: "action.hover",
          backgroundImage: `url(${video.thumbnail_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {badge && (
          <Box
            sx={{
              position: "absolute",
              top: 6,
              left: 6,
              px: 0.6,
              borderRadius: 0.5,
              bgcolor: badge.bgcolor,
              color: "common.white",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {badge.label}
          </Box>
        )}
      </Box>
      <Typography
        fontSize={shorts ? 12.5 : 13}
        sx={{
          mt: 0.75,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <HighlightText text={video.title} keyword={keyword} />
      </Typography>
      <Typography variant={"caption"} color={"text.secondary"}>
        {relativeDayName(published.dateKey) || published.date}
      </Typography>
    </ButtonBase>
  );
}
