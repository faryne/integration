import { useCallback, useState } from "react";
import { usePrimaryShortcut } from "@/helpers/shortcut.ts";

/**
 * 工作台搜尋對話框的開關狀態＋⌘K（Mac）／Ctrl+K（Windows）快捷鍵。
 * 每次開啟都遞增 seq 當對話框的 key，讓它以帶入的關鍵字重新初始化；關閉時保留 seq，
 * 對話框的淡出動畫才不會被重新掛載打斷。
 */
export function useWorkspaceSearchLauncher() {
  const [state, setState] = useState({ seq: 0, open: false, keyword: "" });
  const openSearch = useCallback(
    (keyword = "") =>
      setState((current) =>
        current.open ? current : { seq: current.seq + 1, open: true, keyword },
      ),
    [],
  );
  const closeSearch = useCallback(
    () => setState((current) => ({ ...current, open: false })),
    [],
  );

  usePrimaryShortcut("k", () => openSearch());

  return { ...state, openSearch, closeSearch };
}
