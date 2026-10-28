import { useEffect } from "react";

// 在 url 有值的期間把網址列換成該網址，url 變回 null（或元件卸載）時還原成原本的網址。
// 用 history.replaceState 只換網址列、不觸發 router 換頁，原頁面的 state 不會被重設，
// 適合「在列表頁開 dialog，但網址要顯示成該項目個別頁」這種情境（方便複製分享）。
// 沿用目前的 history.state，避免蓋掉 react-router 存在裡面的 key/idx。
export function useReplaceUrlWhile(url: string | null) {
  useEffect(() => {
    if (!url) return;

    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", url);
    return () => {
      // 期間若已經透過 router 換到別頁，網址就不是我們換上去的那個，不要蓋回去
      if (window.location.pathname + window.location.search !== url) return;
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${search}${hash}`,
      );
    };
  }, [url]);
}
