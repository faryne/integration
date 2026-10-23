import { useEffect, useState } from "react";

// 目前時間（毫秒），每分鐘更新一次；「已開播多久」這類顯示用，render 裡不能直接呼叫 Date.now()
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
