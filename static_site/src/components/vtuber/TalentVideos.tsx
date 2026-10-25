import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

import { useVtuberChannelVideos } from "@/apis/opendata/vtubers.ts";
import {
  VideoSearchForm,
  VideoSearchResults,
  type VideoSearchQuery,
} from "@/components/vtuber/TalentVideoSearch.tsx";
import { VideoCard } from "@/components/vtuber/VideoCard.tsx";
import { videoGridSx } from "@/components/vtuber/videoGrid.ts";
import type { VtuberVideo, VtuberVideoType } from "@/types/vtubers.ts";

const VIDEO_TYPES: [VtuberVideoType, string][] = [
  ["all", "全部"],
  ["live", "直播"],
  ["video", "影片"],
  ["short", "短片"],
];

interface TalentVideosProps {
  handle: string;
  searchAvailable: boolean; // 頻道資料的 video_search_available：YouTube 搜尋額度用完時停用搜尋列
  // vertical：從「短片」分類點開，modal 用直式播放器
  onPlay: (video: VtuberVideo, vertical: boolean) => void;
  onError: (error: unknown) => void;
}

/**
 * 「所有影片」：上方是影片搜尋列；沒在搜尋時依分類（全部／直播／影片／短片）列上傳清單，捲到底自動載入下一頁，短片用直式縮圖。
 * 搜尋時改顯示搜尋結果（藏起分類），「清除搜尋」回到列表
 */
export function TalentVideos({
  handle,
  searchAvailable,
  onPlay,
  onError,
}: TalentVideosProps) {
  const [searching, setSearching] = useState<VideoSearchQuery | null>(null);
  // 搜尋時才發現額度用完（頁面開著時用完）：之後就停用搜尋列，不用等重新整理
  const [quotaGone, setQuotaGone] = useState(false);
  const markQuotaGone = useCallback(() => setQuotaGone(true), []);
  const available = searchAvailable && !quotaGone;
  // 換藝人時清掉搜尋
  useEffect(() => setSearching(null), [handle]);

  return (
    <>
      <VideoSearchForm available={available} onSearch={setSearching} />
      {searching ? (
        <VideoSearchResults
          handle={handle}
          query={searching}
          onPlay={(video) => onPlay(video, false)}
          onClear={() => setSearching(null)}
          onQuotaExhausted={markQuotaGone}
          onError={onError}
        />
      ) : (
        <UploadList handle={handle} onPlay={onPlay} onError={onError} />
      )}
    </>
  );
}

// 上傳清單：依分類讀，捲到底自動載入下一頁
function UploadList({
  handle,
  onPlay,
  onError,
}: Omit<TalentVideosProps, "searchAvailable">) {
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
        <Box sx={videoGridSx(shorts)}>
          {videos.map((video) => (
            <VideoCard
              key={video.video_id}
              video={video}
              shorts={shorts}
              onClick={() => onPlay(video, shorts)}
            />
          ))}
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
