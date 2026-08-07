// 工作台右欄的嵌入式編輯器（故事／設定集／圖像作品）跟左側側邊欄、「回列表」按鈕
// 分別活在不同的元件樹裡，側邊欄要在切換分組前知道「目前編輯器是不是有未存檔的
// 變更」，不能靠 React context（同一時間右欄最多只會掛一個編輯器，訂閱/廣播的
// 開銷沒必要）——用一個模組層級的單一 callback 插槽就夠：編輯器掛載時註冊自己的
// 檢查函式，卸載時自動取消註冊；呼叫端只在真正要離開前才呼叫一次，不訂閱、不觸發
// React 重新渲染。
//
// 這裡只解決「App 內用 navigate() 觸發的路由切換」（回列表按鈕、側邊欄切換），
// 不處理瀏覽器上一頁／重新整理——那兩種是瀏覽器層級的離開，各自有自己的機制
// （beforeunload、popstate），不會經過這裡。
type LeaveGuardCheck = () => boolean;

let currentCheck: LeaveGuardCheck | null = null;

// 回傳的函式是取消註冊用的 cleanup，設計成可以直接當 useEffect 的回傳值。
export function registerWorkspaceLeaveGuard(check: LeaveGuardCheck) {
  currentCheck = check;
  return () => {
    if (currentCheck === check) {
      currentCheck = null;
    }
  };
}

export function hasUnsavedWorkspaceChanges(): boolean {
  return currentCheck?.() ?? false;
}
