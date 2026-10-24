import {
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import { useVtuberChannelVideos } from "@/apis/opendata/vtubers.ts";
import { relativeDayName, taipeiTime } from "@/components/vtuber/format.ts";
import type { VtuberVideo, VtuberVideoType } from "@/types/vtubers.ts";

const VIDEO_TYPES: [VtuberVideoType, string][] = [
  ["all", "全部"],
  ["live", "直播"],
  ["video", "影片"],
  ["short", "短片"],
];

interface TalentVideosProps {
  handle: string;
  onPlay: (video: VtuberVideo) => void;
  onError: (error: unknown) => void;
}

/** 「所有影片」：依分類（全部／直播／影片／短片）列上傳清單，捲到底自動載入下一頁；短片用直式縮圖 */
export function TalentVideos({ handle, onPlay, onError }: TalentVideosProps) {
  const [type, setType] = useState<VtuberVideoType>("all");
  const query = useVtuberChannelVideos(handle, type);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, error } = query;
  const shorts = type === "short";

  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  // 捲到列表底部的哨兵元素時載入下一頁
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage)
        void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const videos = query.data?.pages.flatMap((p) => p.videos) ?? [];
  return (
    <>
      <Stack
        direction={"row"}
        spacing={1}
        sx={{ mb: 1.75, overflowX: "auto", pb: 0.25 }}
      >
        {VIDEO_TYPES.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            clickable
            color={type === value ? "primary" : "default"}
            variant={type === value ? "filled" : "outlined"}
            onClick={() => setType(value)}
            sx={{ flexShrink: 0, px: 0.5 }}
          />
        ))}
      </Stack>

      {query.isSuccess && videos.length === 0 ? (
        <Paper variant={"outlined"} sx={{ p: 4, textAlign: "center" }}>
          <Typography color={"text.secondary"}>沒有影片</Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            // 短片是直式縮圖，一列多放幾張
            gridTemplateColumns: shorts
              ? {
                  xs: "repeat(3, 1fr)",
                  sm: "repeat(auto-fill, minmax(140px, 1fr))",
                }
              : { xs: "1fr 1fr", sm: "repeat(auto-fill, minmax(200px, 1fr))" },
            gap: { xs: shorts ? 1 : 1.25, sm: 1.5 },
          }}
        >
          {videos.map((video) => {
            const published = taipeiTime(video.published_at);
            return (
              <ButtonBase
                key={video.video_id}
                onClick={() => onPlay(video)}
                sx={{ display: "block", textAlign: "left", borderRadius: 1 }}
              >
                {/* YouTube 給的短片縮圖也是 16:9（直式內容在中間），放進 9:16 框置中裁切剛好露出內容 */}
                <Box
                  sx={{
                    aspectRatio: shorts ? "9 / 16" : "16 / 9",
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    backgroundImage: `url(${video.thumbnail_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
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
                  {video.title}
                </Typography>
                <Typography variant={"caption"} color={"text.secondary"}>
                  {relativeDayName(published.dateKey) || published.md}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      )}
      <Box ref={sentinel} sx={{ py: 2, textAlign: "center" }}>
        {(query.isLoading || isFetchingNextPage) && (
          <CircularProgress size={24} />
        )}
      </Box>
    </>
  );
}
