import { useEffect, useSyncExternalStore } from "react";

// 動態頁面（影片、藝人等）在導覽推導出的麵包屑後面補上最後一層，例如「MDVR-448 片名」。
// 同一時間只會有一個頁面在畫面上，用模組層級的單一值就夠了，不需要 Context
let tail = "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** 頁面掛載時設定麵包屑最後一層，離開時自動清除；label 為空時不顯示 */
export function useBreadcrumbTail(label: string | undefined) {
  useEffect(() => {
    if (!label) return;
    tail = label;
    emit();
    return () => {
      tail = "";
      emit();
    };
  }, [label]);
}

/** SiteBreadcrumbs 讀取目前的最後一層 */
export function useBreadcrumbTailValue() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => tail,
  );
}
