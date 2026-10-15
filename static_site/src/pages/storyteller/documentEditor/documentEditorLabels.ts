import type { DocumentKind } from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

// 共用編輯頁（SteamLoomDocumentEditor 與底下的頁首、歷史、自動存檔）的介面文字。
// 網站直接用這裡的預設值；SteamLoom Writer 有多語系，由 Writer 用 i18n 組一份蓋過去。
export interface DocumentEditorLabels {
  tabs: { editor: string; history: string };
  // 只編輯某一章時的狀態標籤（「只編輯：第二章」）與回到全文
  scope: { only: string; backToFull: string };
  titlePlaceholder: string;
  summaryPlaceholder: string;
  status: string;
  group: string;
  authors: string;
  // 署名選項的「本人」；有筆名時帶筆名
  self: (penName?: string) => string;
  ungrouped: string;
  spoiler: string;
  spoilerNo: string;
  spoilerYes: string;
  dependsOn: string;
  dependencyStory: string;
  dependencyLore: string;
  autoSave: {
    label: string;
    off: string;
    every: (minutes: number) => string;
    custom: string;
    range: (min: number, max: number) => string;
  };
  conflict: string;
  viewHistory: string;
  saveFailedBanner: string;
  insertAsset: string;
  insertAssetTitle: string;
  assetInserted: string;
  assetInsertFailed: string;
  backToList: string;
  historyEmpty: string;
  reverted: string;
  revertFailed: string;
}

export const defaultDocumentEditorLabels = (
  kind: DocumentKind,
): DocumentEditorLabels => {
  const name = kind === "story" ? "故事" : "設定";
  return {
    tabs: { editor: "編輯", history: "編輯歷史" },
    scope: { only: "只編輯", backToFull: "回到全文" },
    titlePlaceholder: kind === "story" ? "未命名故事" : "未命名設定",
    summaryPlaceholder: "新增摘要...",
    status: "狀態",
    group: kind === "story" ? "冊" : "設定集",
    authors: "署名",
    self: (penName) => (penName ? `本人（${penName}）` : "本人"),
    ungrouped: kind === "story" ? "不分冊" : "未歸類",
    spoiler: "劇透",
    spoilerNo: "無劇透",
    spoilerYes: "含劇透",
    dependsOn: "需先讀過",
    dependencyStory: "故事",
    dependencyLore: "設定",
    autoSave: {
      label: "自動存檔",
      off: "不自動存檔",
      every: (minutes) => `每 ${minutes} 分鐘`,
      custom: "自訂頻率",
      range: (min, max) => `${min}-${max} 分鐘`,
    },
    conflict: `剛剛存檔完成後才發現這篇${name}在中途被更新過，已經接在最新版本後面存成新版了。`,
    viewHistory: "查看編輯歷史",
    saveFailedBanner: "存檔失敗，請確認登入狀態與欄位內容。",
    insertAsset: "插入資產",
    insertAssetTitle: `插入${name}資產`,
    assetInserted: "已插入資產。",
    assetInsertFailed: "無法插入資產，請重新整理後再試。",
    backToList: "回列表",
    historyEmpty: `新${name}第一次存檔後才會產生編輯歷史。`,
    reverted: "已回復到這個版本。",
    revertFailed: `回復${name}版本失敗，請重試。`,
  };
};
