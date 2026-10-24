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

// 台北日期字串加減天數：shiftDateKey("2026-10-24", -1) → "2026-10-23"
export function shiftDateKey(dateKey: string, days: number) {
  return new Date(Date.parse(dateKey) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
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

// 毫秒 → 「9 分鐘」「1 小時 23 分」「1 天 2 小時」
// 不用「1:05」：會被當成分秒，連播一天以上還會變成「26:05」這種像時鐘的數字
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "不到 1 分鐘";
  if (hours < 1) return `${minutes} 分鐘`;
  // 超過一天只顯示到小時，分鐘在這個尺度已經不重要
  if (days >= 1) return `${days} 天${hours % 24 ? ` ${hours % 24} 小時` : ""}`;
  return `${hours} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ""}`;
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

// 卒業生頭像的虛線圓環；直播中、目前這位的實線框會蓋過它
export const GRADUATED_RING = {
  outlineStyle: "dashed",
  outlineColor: "text.secondary",
} as const;

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
    when: `${start.md} ${start.hm}`,
    status: live.status,
    viewers: live.concurrent_viewers,
  };
}
