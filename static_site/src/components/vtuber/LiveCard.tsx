import { Box, CardActionArea, Paper, Stack, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";

import {
  formatDuration,
  liveStartAt,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import { useNow } from "@/components/vtuber/useNow.ts";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import type { VtuberLive } from "@/types/vtubers.ts";

interface LiveCardProps {
  live: VtuberLive;
  // 藝人頁的大卡片：縮圖與資訊左右排、不顯示頭像
  large?: boolean;
  onPlay: (live: VtuberLive) => void;
}

/** 直播中卡片：縮圖、LIVE、同接人數、已開播多久 */
export function LiveCard({ live, large = false, onPlay }: LiveCardProps) {
  const start = liveStartAt(live);
  const now = useNow();
  const elapsed = formatDuration(now - Date.parse(start));
  return (
    <Paper
      variant={"outlined"}
      sx={{ overflow: "hidden", ...(large && { borderColor: "error.main" }) }}
    >
      <CardActionArea
        onClick={() => onPlay(live)}
        sx={{
          display: "grid",
          gridTemplateColumns: large ? { xs: "1fr", md: "1.2fr 1fr" } : "1fr",
          alignItems: "stretch",
        }}
      >
        <Box
          sx={{
            position: "relative",
            aspectRatio: "16 / 9",
            bgcolor: "action.hover",
            backgroundImage: `url(${live.thumbnail_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box
            component={"span"}
            sx={{
              position: "absolute",
              left: 8,
              top: 8,
              px: 1,
              borderRadius: 0.5,
              bgcolor: "error.main",
              color: "common.white",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            LIVE
          </Box>
          {live.concurrent_viewers != null && (
            <Stack
              direction={"row"}
              alignItems={"center"}
              spacing={0.25}
              sx={{
                position: "absolute",
                right: 8,
                bottom: 8,
                px: 0.75,
                borderRadius: 0.5,
                bgcolor: "rgba(0,0,0,.7)",
                color: "common.white",
                fontSize: 12,
              }}
            >
              <PersonIcon sx={{ fontSize: 14 }} />
              {live.concurrent_viewers.toLocaleString()}
            </Stack>
          )}
        </Box>
        <Box
          sx={{
            p: large ? 2 : 1.5,
            alignSelf: large ? "center" : "auto",
            minWidth: 0,
          }}
        >
          {/* 標題用滿卡片寬度；一般卡片固定兩行高，同一排的卡片才會對齊 */}
          <Typography
            fontWeight={large ? 700 : 400}
            fontSize={large ? 16 : 14}
            sx={{
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              ...(!large && { minHeight: "2.9em" }),
            }}
          >
            {live.title}
          </Typography>
          {large ? (
            <Typography
              variant={"body2"}
              color={"text.secondary"}
              sx={{ mt: 0.5 }}
            >
              {taipeiTime(start).hm} 開播・已開播 {elapsed}
            </Typography>
          ) : (
            // 頭像縮小放進頻道那一行（不再獨佔左邊一欄）；頻道名太長就省略，已開播時間靠右不換行
            <Stack
              direction={"row"}
              spacing={0.75}
              alignItems={"center"}
              sx={{ mt: 0.75, minWidth: 0 }}
            >
              <ChannelAvatar
                src={live.channel_thumbnail_url}
                sx={{ width: 20, height: 20 }}
              />
              <Typography
                variant={"body2"}
                color={"text.secondary"}
                noWrap
                sx={{ minWidth: 0 }}
              >
                {live.channel_title}
              </Typography>
              <Typography
                variant={"body2"}
                color={"text.secondary"}
                sx={{ flexShrink: 0, ml: "auto !important" }}
              >
                已開播 {elapsed}
              </Typography>
            </Stack>
          )}
        </Box>
      </CardActionArea>
    </Paper>
  );
}
