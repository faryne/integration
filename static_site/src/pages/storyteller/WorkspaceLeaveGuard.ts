import { useEffect, useRef } from "react";
import type { DocumentSaveResult } from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

// 工作台右欄的嵌入式編輯器（故事／設定集／圖像作品）跟左側側邊欄、「回列表」按鈕
// 分別活在不同的元件樹裡，側邊欄要在切換分組前知道「目前編輯器是不是有未存檔的
// 變更」，不能靠 React context（同一時間右欄最多只會掛一個編輯器，訂閱/廣播的
// 開銷沒必要）——用一個模組層級的單一插槽就夠：編輯器掛載時註冊自己的
// 檢查函式（以及可選的存檔函式），卸載時自動取消註冊；呼叫端只在真正要離開前才呼叫，
// 不訂閱、不觸發 React 重新渲染。網站工作台與 SteamLoom Writer 共用這一套規則。
//
// 這裡只解決「App 內用 navigate() 觸發的路由切換」（回列表按鈕、側邊欄切換），
// 不處理瀏覽器上一頁／重新整理——那兩種是瀏覽器層級的離開，各自有自己的機制
// （beforeunload、popstate），不會經過這裡。
type LeaveGuardCheck = () => boolean;
// 未存檔確認的「存檔並繼續」：存檔成功且沒有版本衝突才回傳 true（衝突要留在編輯頁讓作者看到提示）
type LeaveGuardSave = () => Promise<boolean>;

let current: { check: LeaveGuardCheck; save?: LeaveGuardSave } | null = null;

// 回傳的函式是取消註冊用的 cleanup，設計成可以直接當 useEffect 的回傳值。
export function registerWorkspaceLeaveGuard(
  check: LeaveGuardCheck,
  save?: LeaveGuardSave,
) {
  const entry = { check, save };
  current = entry;
  return () => {
    if (current === entry) {
      current = null;
    }
  };
}

export function hasUnsavedWorkspaceChanges(): boolean {
  return current?.check() ?? false;
}

// 目前的編輯器有沒有提供存檔函式；沒有就不顯示「存檔並繼續」
export function canSaveWorkspaceBeforeLeave(): boolean {
  return Boolean(current?.save);
}

export function saveWorkspaceBeforeLeave(): Promise<boolean> {
  return current?.save?.() ?? Promise.resolve(false);
}

// 用 useDocumentEditing 的編輯器（網站文字編輯頁、Writer 的文字／圖像編輯器）共用的登記：
// editing 每次 render 都是新物件，用 ref 讓登記出去的函式永遠讀到最新狀態，只需在掛載時登記一次。
export function useDocumentEditingLeaveGuard(
  editing: {
    hasUnsavedChanges: () => boolean;
    save: (trigger: "manual") => Promise<DocumentSaveResult | null>;
  },
  enabled = true,
) {
  const latest = useRef(editing);
  useEffect(() => {
    latest.current = editing;
  });
  useEffect(() => {
    if (!enabled) return;
    return registerWorkspaceLeaveGuard(
      () => latest.current.hasUnsavedChanges(),
      async () => {
        const result = await latest.current.save("manual");
        return Boolean(result && !result.conflict);
      },
    );
  }, [enabled]);
}
