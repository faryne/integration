import { Stack, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useEffect, useState } from "react";

import { useVtuberVideoDetail } from "@/apis/opendata/vtubers.ts";
import { YouTubeDialog } from "@/components/common/YouTubeDialog.tsx";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { LiveStatusChip } from "@/components/vtuber/LiveStatusChip.tsx";
import { formatDuration } from "@/components/vtuber/format.ts";
import { useNow } from "@/components/vtuber/useNow.ts";
import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

interface VideoModalProps {
  video: VtuberPlayingVideo | null;
  onClose: () => void;
}

/** VTuber 頁的影片 modal：組好頻道・時間・狀態那一行、點開時才抓說明，交給共用的 YouTubeDialog 顯示 */
export function VideoModal({ video, onClose }: VideoModalProps) {
  // 關閉時保留最後一部影片，dialog 淡出時內容才不會瞬間消失
  const [last, setLast] = useState(video);
  useEffect(() => {
    if (video) setLast(video);
  }, [video]);
  const current = video ?? last;
  const detail = useVtuberVideoDetail(video?.videoId);
  const now = useNow();

  if (!current) return null;
  const duration = playingDuration(current, now);
  return (
    <YouTubeDialog
      open={Boolean(video)}
      videoId={current.videoId}
      title={current.title}
      vertical={current.vertical}
      description={detail.data?.description}
      descriptionLoading={detail.isLoading}
      onClose={onClose}
      meta={
        // 頻道一行（名稱太長就省略）；時間・時長・同接・狀態另起一行，手機上才不會把頻道名擠掉
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack
            direction={"row"}
            spacing={1}
            alignItems={"center"}
            sx={{ minWidth: 0 }}
          >
            <ChannelAvatar
              src={current.channelThumbnailUrl}
              sx={{ width: 22, height: 22 }}
            />
            <Typography
              variant={"body2"}
              color={"text.secondary"}
              noWrap
              sx={{ minWidth: 0 }}
            >
              {current.channelTitle}
            </Typography>
          </Stack>
          <Stack
            direction={"row"}
            spacing={1}
            alignItems={"center"}
            flexWrap={"wrap"}
            useFlexGap
          >
            <Typography variant={"body2"} color={"text.secondary"}>
              {current.when}
              {duration && `・${duration}`}
            </Typography>
            {current.status === "live" && current.viewers != null && (
              <Stack
                direction={"row"}
                alignItems={"center"}
                sx={{ color: "text.secondary" }}
              >
                <PersonIcon sx={{ fontSize: 16 }} />
                <Typography variant={"body2"}>
                  {current.viewers.toLocaleString()}
                </Typography>
              </Stack>
            )}
            {current.status && <LiveStatusChip status={current.status} />}
          </Stack>
        </Stack>
      }
    />
  );
}

// 直播中：已開播多久；已結束：直播了多久；存檔與待機中沒有實際開播時間就不顯示
function playingDuration(v: VtuberPlayingVideo, now: number) {
  if (!v.startedAt) return null;
  const start = Date.parse(v.startedAt);
  if (v.status === "live") return `已開播 ${formatDuration(now - start)}`;
  if (v.status === "ended" && v.endedAt)
    return `直播 ${formatDuration(Date.parse(v.endedAt) - start)}`;
  return null;
}
