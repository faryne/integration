import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// 局部更新網址參數（null／空字串＝刪除），以 replace 寫入避免塞爆上一頁。
// 以 window.location.search 為基底而非 hook 回傳值：連續快速更新時 hook 的值可能還沒 re-render，會互相覆蓋。
export function useUpdateSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      Object.entries(patch).forEach(([key, value]) =>
        value ? next.set(key, value) : next.delete(key),
      );
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );
  return [searchParams, updateParams] as const;
}
