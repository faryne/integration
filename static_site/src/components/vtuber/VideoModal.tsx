import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonIcon from "@mui/icons-material/Person";
import { useLayoutEffect, useRef, useState } from "react";

import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { youtubeWatchUrl } from "@/components/vtuber/format.ts";
import { LiveStatusChip } from "@/components/vtuber/LiveStatusChip.tsx";
import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

interface VideoModalProps {
  video: VtuberPlayingVideo | null;
  onClose: () => void;
}

/**
 * 點直播或影片開的 modal：直接嵌入 YouTube 播放。
 * 手機版資訊與按鈕上下兩段，標題才能用滿寬度；桌機寬度夠，維持一列。
 */
export function VideoModal({ video, onClose }: VideoModalProps) {
  return (
    <Dialog open={Boolean(video)} onClose={onClose} maxWidth={"md"} fullWidth>
      {video && (
        <ModalBody key={video.videoId} video={video} onClose={onClose} />
      )}
    </Dialog>
  );
}

// 手機上兩顆按鈕平分寬度；不轉大寫、不換行（「YOUTUBE」大寫會變寬，窄螢幕被擠成三行）
const buttonSx = {
  flex: { xs: 1, sm: "none" },
  textTransform: "none",
  whiteSpace: "nowrap",
} as const;

// 換影片時用 key 重建，展開狀態與截斷判斷跟著重來
function ModalBody({
  video,
  onClose,
}: {
  video: VtuberPlayingVideo;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  // 只有標題真的被行數上限截斷時才顯示「展開」
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el && !expanded) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [expanded, video.title]);

  return (
    <>
      <Box sx={{ aspectRatio: "16 / 9", bgcolor: "common.black" }}>
        <Box
          component={"iframe"}
          src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
          title={video.title}
          allow={
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          }
          allowFullScreen
          sx={{ width: "100%", height: "100%", border: 0 }}
        />
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1.5, sm: 2 }}
        sx={{ p: 2, alignItems: { sm: "flex-start" } }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            ref={titleRef}
            fontWeight={700}
            fontSize={15}
            sx={{
              lineHeight: 1.5,
              ...(!expanded && {
                display: "-webkit-box",
                WebkitLineClamp: { xs: 3, sm: 2 },
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
            }}
          >
            {video.title}
          </Typography>
          {(truncated || expanded) && (
            <Button
              size={"small"}
              onClick={() => setExpanded(!expanded)}
              sx={{ px: 0, minWidth: 0 }}
            >
              {expanded ? "收合" : "展開"}
            </Button>
          )}
          {/* 頻道名太長就省略，時間、同接、狀態固定不換行 */}
          <Stack
            direction={"row"}
            spacing={1}
            alignItems={"center"}
            sx={{ mt: 1, minWidth: 0 }}
          >
            <ChannelAvatar
              src={video.channelThumbnailUrl}
              sx={{ width: 22, height: 22 }}
            />
            <Typography
              variant={"body2"}
              color={"text.secondary"}
              noWrap
              sx={{ minWidth: 0 }}
            >
              {video.channelTitle}
            </Typography>
            <Typography
              variant={"body2"}
              color={"text.secondary"}
              sx={{ flexShrink: 0 }}
            >
              {video.when}
            </Typography>
            {video.status === "live" && video.viewers != null && (
              <Stack
                direction={"row"}
                alignItems={"center"}
                sx={{ flexShrink: 0, color: "text.secondary" }}
              >
                <PersonIcon sx={{ fontSize: 16 }} />
                <Typography variant={"body2"}>
                  {video.viewers.toLocaleString()}
                </Typography>
              </Stack>
            )}
            {video.status && <LiveStatusChip status={video.status} />}
          </Stack>
        </Box>
        <Stack direction={"row"} spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            variant={"outlined"}
            startIcon={<OpenInNewIcon />}
            href={youtubeWatchUrl(video.videoId)}
            target={"_blank"}
            rel={"noopener"}
            sx={buttonSx}
          >
            在 YouTube 開啟
          </Button>
          <Button onClick={onClose} color={"inherit"} sx={buttonSx}>
            關閉
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
