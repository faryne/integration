import { useEffect, useState } from "react";

const welcomeGuidePendingKey = "storyteller-welcome-guide-pending";

// 功能導覽只在「這次真的完成第一次筆名設定」才彈（見 PenNameDialog 的 onCompleted 說明）。
// 例外是 OAuth 授權頁：在那裡設定完筆名時先不跳（會打斷授權），改記一個待辦旗標，
// 等使用者之後回到 storyteller 其他頁面再補跳；localStorage 讀寫失敗就當作不補跳。
export function useWelcomeGuide(deferred: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (deferred) return;
    try {
      if (window.localStorage.getItem(welcomeGuidePendingKey)) {
        window.localStorage.removeItem(welcomeGuidePendingKey);
        setOpen(true);
      }
    } catch {
      // 無痕模式等情況讀不到 storage，不影響其他功能
    }
  }, [deferred]);
  function onPenNameCompleted() {
    if (!deferred) {
      setOpen(true);
      return;
    }
    try {
      window.localStorage.setItem(welcomeGuidePendingKey, "1");
    } catch {
      // 同上，存不了就略過這次導覽
    }
  }
  return { open, close: () => setOpen(false), onPenNameCompleted };
}
