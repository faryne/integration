import { useEffect, useRef } from "react";

// iPadOS 也回報 MacIntel，外接鍵盤一樣用 ⌘，歸在 Mac 這邊是對的。
export const isMacPlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/**
 * 判斷是否為「主修飾鍵＋key」：Mac 只認 ⌘、其他平台只認 Ctrl。
 * 不兩者通吃——Mac 的 Ctrl+K 是文字框內 Emacs 式「刪到行尾」，Windows 的 Win 鍵組合
 * 屬於系統，都不該被網頁攔下；Alt／Shift 組合也排除（Windows AltGr 會帶 Ctrl+Alt）。
 */
export function isPrimaryShortcut(event: KeyboardEvent, key: string) {
  const primary = isMacPlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  return (
    primary &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}

/** 給 UI 顯示的快捷鍵文字：Mac「⌘S」、Windows／Linux「Ctrl+S」。 */
export function shortcutLabel(key: string) {
  return isMacPlatform ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

/** 在 window 註冊主修飾鍵快捷鍵；handler 每次 render 更新，不必自己包 ref。 */
export function usePrimaryShortcut(key: string, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isPrimaryShortcut(event, key)) return;
      event.preventDefault();
      handlerRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key]);
}
