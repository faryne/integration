import { useState } from "react";

import { trackEvent } from "@/lib/analytics.ts";

/** 首頁版面：compact＝一屏版（預設）、classic＝原版面 */
export type HomeLayout = "compact" | "classic";

const LAYOUT_KEY = "joyu.home-layout";
const RATED_KEY = "joyu.home-layout-rated.";

// localStorage 在無痕／封鎖網站資料時可能拋錯，讀寫一律包 try，失敗就當沒存
const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 存不了就算了，只影響下次開站的預設 */
  }
};

/** 目前的首頁版面（記在這台瀏覽器）；切換時送 GA 事件 home_layout_switch */
export function useHomeLayout() {
  const [layout, setLayout] = useState<HomeLayout>(() =>
    read(LAYOUT_KEY) === "classic" ? "classic" : "compact",
  );
  const change = (next: HomeLayout) => {
    setLayout(next);
    write(LAYOUT_KEY, next);
    trackEvent("home_layout_switch", { to: next });
  };
  return [layout, change] as const;
}

/**
 * 這個版面在這台瀏覽器評過分沒；評分送 GA 事件 home_layout_rating（layout、score 1～5）。
 * rated 只在掛載時讀一次（評完當下由 ScoreRating 自己收起，才看得到感謝提示）；
 * 使用處要用 key={layout} 讓切換版面時重新判斷
 */
export function useHomeLayoutRating(layout: HomeLayout) {
  const [rated] = useState(() => read(RATED_KEY + layout) !== null);
  const rate = (score: number) => {
    write(RATED_KEY + layout, String(score));
    trackEvent("home_layout_rating", { layout, score });
  };
  return { rated, rate };
}
