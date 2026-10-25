import { useEffect, useState } from "react";

// 值停止變動 delayMs 後才更新，邊打字邊查 API 時避免每個字都送一次
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
