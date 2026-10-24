import { Stack, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useEffect, useState } from "react";

import { useVtuberVideoDetail } from "@/apis/opendata/vtubers.ts";
import { YouTubeDialog } from "@/components/common/YouTubeDialog.tsx";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { LiveStatusChip } from "@/components/vtuber/LiveStatusChip.tsx";
import {
  detailPlayingVideo,
  formatDuration,
} from "@/components/vtuber/format.ts";
import { useNow } from "@/components/vtuber/useNow.ts";
import type { VtuberPlayingVideo } from "@/types/vtubers.ts";

interface VideoModalProps {
  videoId: string | undefined; // 影片網址上的 ID；沒有就是關閉
  initial?: VtuberPlayingVideo; // 站內點開時已有的資料；直接打開分享連結時沒有，等 API
  onClose: () => void;
  onMissing: (error: unknown) => void; // 直接打開網址卻查不到時呼叫，由上層跳 snack 並關閉
}

/** VTuber 頁的影片 modal：組好頻道・時間・狀態那一行、點開時才抓說明（直接打開網址時也靠它組資料），交給共用的 YouTubeDialog 顯示 */
export function VideoModal({
  videoId,
  initial,
  onClose,
  onMissing,
}: VideoModalProps) {
  const detail = useVtuberVideoDetail(videoId);
  const video = videoId
    ? (initial ?? (detail.data ? detailPlayingVideo(detail.data) : null))
    : null;
  // 關閉時保留最後一部影片，dialog 淡出時內容才不會瞬間消失
  const [last, setLast] = useState(video);
  useEffect(() => {
    if (video) setLast(video);
  }, [video]);
  // 直接打開網址卻查不到（不存在、不是追蹤的頻道、額度用完）交給上層處理；站內點開的只是少了說明，不打斷
  const failed = Boolean(videoId && !initial && detail.error);
  useEffect(() => {
    if (failed) onMissing(detail.error);
  }, [failed, detail.error, onMissing]);
  const current = video ?? last;
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
