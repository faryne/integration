import type { DocumentSaveResult } from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";
import { useEffect, useRef } from "react";

// 外層用來「存檔並繼續」的函式：成功且沒有版本衝突才回傳 true（衝突時要留在編輯頁讓作者看到衝突提示）
export type SaveForLeave = () => Promise<boolean>;

// 編輯器掛載時向工作台登記存檔函式，離開這篇時撤銷；未存檔確認對話框按「存檔並繼續」時呼叫。
// 存檔函式每次 render 都是新的，用 ref 讓登記出去的版本永遠呼叫最新的那個。
export function useRegisterSave(register: (save: SaveForLeave | null) => void, save: () => Promise<DocumentSaveResult | null>) {
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    register(async () => {
      const result = await latest.current();
      return Boolean(result && !result.conflict);
    });
    return () => register(null);
    // 只在掛載／卸載時登記
  }, []);
}
