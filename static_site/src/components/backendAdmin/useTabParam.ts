import { useSearchParams } from "react-router-dom";

/**
 * 後台子分頁存在網址的 ?tab=，重新整理或分享時停在同一個分頁；
 * 不在 tabs 清單裡的值一律當成第一個。切換分頁時清掉其他 query（頁碼、搜尋）
 */
export function useTabParam<T extends string>(tabs: readonly T[]) {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((t) => t === params.get("tab")) ?? tabs[0];
  const setTab = (next: T) =>
    setParams(next === tabs[0] ? {} : { tab: next }, { replace: true });
  return [tab, setTab] as const;
}
