import type { VtuberLiveHistoryItem } from "@/types/vtubers.ts";

// 直播統計的計算（依週分組、時段熱力圖、合計）；一律以台北時間切日與小時
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 台北沒有日光節約，加 8 小時後用 UTC getter 讀到的就是台北的日期與時刻
const TAIPEI_OFFSET = 8 * HOUR;
// prod 從這天開始收直播。在這之前的週不畫（不然會是一排 0，看起來像藝人沒在播）；
// 之前的直播只有第一次掃 RSS 時順帶撿到的幾場，不完整，也一律不算
const TRACKING_SINCE = Date.parse("2026-10-23T00:00:00+08:00");

const startMs = (l: VtuberLiveHistoryItem) => Date.parse(l.actual_start_at);
const endMs = (l: VtuberLiveHistoryItem) => Date.parse(l.actual_end_at);
// 星期一＝0 … 星期日＝6
const taipeiWeekday = (ms: number) =>
  (new Date(ms + TAIPEI_OFFSET).getUTCDay() + 6) % 7;

// 統計分頁所有直播卡片共用的資料範圍
export function trackedLives(lives: VtuberLiveHistoryItem[]) {
  return lives.filter((l) => startMs(l) >= TRACKING_SINCE);
}

export interface LiveSummary {
  count: number;
  totalMs: number;
}

export function summarizeLives(lives: VtuberLiveHistoryItem[]): LiveSummary {
  return {
    count: lives.length,
    totalMs: lives.reduce((sum, l) => sum + endMs(l) - startMs(l), 0),
  };
}

export interface LiveWeek {
  week: Date; // 該週星期一（本地時間的同一個日期，圖上才不會差一天）
  count: number;
  hours: number;
}

// 每週一根長條：從期間起點（不早於開始收直播那天）那週到這週都列出來，沒播的週是 0；場次與時數都算在開播那一週
export function weeklyLives(
  lives: VtuberLiveHistoryItem[],
  days: number,
  now = Date.now(),
): LiveWeek[] {
  // 台北時間該週星期一 00:00 的「台北日期」，以 UTC 毫秒表示，當 Map 的 key
  const weekKey = (ms: number) => {
    const local = ms + TAIPEI_OFFSET;
    return Math.floor(local / DAY) * DAY - taipeiWeekday(ms) * DAY;
  };
  const weeks = new Map<number, LiveWeek>();
  for (
    let key = weekKey(Math.max(now - days * DAY, TRACKING_SINCE));
    key <= weekKey(now);
    key += 7 * DAY
  ) {
    const d = new Date(key);
    weeks.set(key, {
      week: new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      count: 0,
      hours: 0,
    });
  }
  for (const l of lives) {
    const bucket = weeks.get(weekKey(startMs(l)));
    if (!bucket) continue;
    bucket.count++;
    bucket.hours += (endMs(l) - startMs(l)) / HOUR;
  }
  return [...weeks.values()];
}

export interface HeatCell {
  hours: number; // 這個時段累計在播的時數
  lives: number; // 有播到這個時段的場次
}

// 星期（列，一～日）× 小時（欄，0～23）；跨小時、跨日的直播照實際時間分攤到每一格
export function liveHeatmap(lives: VtuberLiveHistoryItem[]): HeatCell[][] {
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ hours: 0, lives: 0 })),
  );
  for (const l of lives) {
    const end = endMs(l);
    for (let t = startMs(l); t < end;) {
      const next =
        Math.floor((t + TAIPEI_OFFSET) / HOUR) * HOUR - TAIPEI_OFFSET + HOUR;
      const cell =
        grid[taipeiWeekday(t)][new Date(t + TAIPEI_OFFSET).getUTCHours()];
      cell.hours += (Math.min(next, end) - t) / HOUR;
      cell.lives++;
      t = next;
    }
  }
  return grid;
}
