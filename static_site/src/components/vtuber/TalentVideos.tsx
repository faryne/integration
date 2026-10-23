import { Box, ButtonBase, CircularProgress, Typography } from "@mui/material";
import { useEffect, useRef } from "react";

import { useVtuberChannelVideos } from "@/apis/opendata/vtubers.ts";
import { relativeDayName, taipeiTime } from "@/components/vtuber/format.ts";
import type { VtuberVideo } from "@/types/vtubers.ts";

interface TalentVideosProps {
  handle: string;
  onPlay: (video: VtuberVideo) => void;
  onError: (error: unknown) => void;
}

/** 「所有影片」：上傳清單（含直播存檔）縮圖格，捲到底自動載入下一頁 */
export function TalentVideos({ handle, onPlay, onError }: TalentVideosProps) {
  const query = useVtuberChannelVideos(handle, true);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, error } = query;

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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "repeat(auto-fill, minmax(200px, 1fr))",
          },
          gap: { xs: 1.25, sm: 1.5 },
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
              <Box
                sx={{
                  aspectRatio: "16 / 9",
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  backgroundImage: `url(${video.thumbnail_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <Typography
                fontSize={13}
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
      <Box ref={sentinel} sx={{ py: 2, textAlign: "center" }}>
        {(query.isLoading || isFetchingNextPage) && (
          <CircularProgress size={24} />
        )}
      </Box>
    </>
  );
}
