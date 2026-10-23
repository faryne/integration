import type {
  VtuberLive,
  VtuberLiveStatus,
  VtuberPlayingVideo,
} from "@/types/vtubers.ts";

// 時間一律用台北時間顯示（規格），不跟著瀏覽器時區
const TIME_ZONE = "Asia/Taipei";
const WEEKDAYS = "日一二三四五六";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface TaipeiTime {
  dateKey: string; // 2026-10-23，分組用
  md: string; // 10/23
  hm: string; // 21:30
  weekday: string; // 五
}

export function taipeiTime(value: string | Date): TaipeiTime {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return {
    dateKey: `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`,
    md: `${parts.month}/${parts.day}`,
    hm: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS[WEEKDAY_INDEX[parts.weekday]],
  };
}

// 今天／明天／後天，其餘回空字串
export function relativeDayName(dateKey: string, now = new Date()) {
  const today = Date.parse(taipeiTime(now).dateKey);
  const diff = Math.round((Date.parse(dateKey) - today) / 86_400_000);
  return ["今天", "明天", "後天"][diff] ?? "";
}

// API 預設從一天前開始查；時間表只列台北時間今天以後的場次（今天已結束的仍保留）
export function fromToday(lives: VtuberLive[], now: number) {
  const today = taipeiTime(new Date(now)).dateKey;
  return lives.filter((l) => taipeiTime(liveStartAt(l)).dateKey >= today);
}

// 已開播用實際時間，否則用預定時間
export function liveStartAt(live: VtuberLive) {
  return live.actual_start_at ?? live.scheduled_start_at ?? live.updated_at;
}

// 毫秒 → 1:05
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

// 訂閱數、觀看數：2.54M、31.5K、6.52 億
export function formatCount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)} 億`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatSignedCount(value: number) {
  return `${value >= 0 ? "+" : ""}${formatCount(value)}`;
}

export const LIVE_STATUS_LABELS: Record<VtuberLiveStatus, string> = {
  upcoming: "待機中",
  live: "直播中",
  ended: "已結束",
  cancelled: "已取消",
};

// 直播 → 影片 modal 的內容
export function livePlayingVideo(live: VtuberLive): VtuberPlayingVideo {
  const start = taipeiTime(liveStartAt(live));
  return {
    videoId: live.video_id,
    title: live.title,
    channelTitle: live.channel_title,
    channelThumbnailUrl: live.channel_thumbnail_url,
    meta:
      live.status === "live" && live.concurrent_viewers != null
        ? `直播中・${live.concurrent_viewers.toLocaleString()} 人觀看`
        : `${start.md} ${start.hm}・${LIVE_STATUS_LABELS[live.status]}`,
  };
}

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
