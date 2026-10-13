import { createContext, useContext, useEffect, useState, type DependencyList } from "react";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { errorMessage, isNotLoggedIn } from "@writer/lib/backend.ts";

// 呼叫 API 時發現授權失效（過期或在網站上被撤銷）要通知外層切回登入頁，由 App 的 Shell 提供。
export const SessionExpiredContext = createContext<() => void>(() => {});

// 載入 Go 綁定的資料：deps 變動就重抓，切換期間回 null；錯誤統一跳 snack，授權失效交給 SessionExpiredContext。
// 回傳 undefined 代表載入失敗（已提示過），呼叫端可以據此顯示空狀態而不是一直轉圈。
export function useBackendData<T>(load: () => Promise<T>, deps: DependencyList): T | null | undefined {
  const { showError } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const [data, setData] = useState<T | null | undefined>(null);

  useEffect(() => {
    // 快速切換時忽略已過期的回應，避免舊資料蓋掉新資料
    let active = true;
    setData(null);
    // 包一層 Promise：load 同步丟例外（例如綁定不存在）也走同一套錯誤處理，不會讓整個畫面當掉
    Promise.resolve()
      .then(load)
      .then((result) => active && setData(result))
      .catch((err) => {
        if (!active) return;
        if (isNotLoggedIn(err)) return onSessionExpired();
        showError(errorMessage(err));
        setData(undefined);
      });
    return () => {
      active = false;
    };
    // deps 由呼叫端決定，load 每次 render 都是新的函式不列入
  }, deps);

  return data;
}
