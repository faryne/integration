import type { TFunction } from "i18next";
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

// 網站的預設文字取 web.documentEditor.*；譯文與 Writer 的 workspace.editor.* 同一份，兩端用詞一致。
export const defaultDocumentEditorLabels = (
  kind: DocumentKind,
  t: TFunction,
): DocumentEditorLabels => {
  const k = (key: string) => t(`web.documentEditor.${key}`);
  return {
    tabs: { editor: k("tabs.editor"), history: k("tabs.history") },
    scope: { only: k("scope.only"), backToFull: k("scope.backToFull") },
    titlePlaceholder: k(`titlePlaceholder.${kind}`),
    summaryPlaceholder: k(`summaryPlaceholder.${kind}`),
    status: k("status"),
    group: k(`group.${kind}`),
    authors: k("authors"),
    self: (penName) =>
      penName ? t("web.documentEditor.self", { penName }) : k("selfOnly"),
    ungrouped: k(`ungrouped.${kind}`),
    spoiler: k("spoiler.label"),
    spoilerNo: k("spoiler.no"),
    spoilerYes: k("spoiler.yes"),
    dependsOn: k("dependsOn"),
    dependencyStory: k("dependency.story"),
    dependencyLore: k("dependency.lore"),
    autoSave: {
      label: k("autoSave.label"),
      off: k("autoSave.off"),
      every: (minutes) => t("web.documentEditor.autoSave.every", { minutes }),
      custom: k("autoSave.custom"),
      range: (min, max) => t("web.documentEditor.autoSave.range", { min, max }),
    },
    conflict: k(`conflict.${kind}`),
    viewHistory: k("conflict.viewHistory"),
    saveFailedBanner: k("saveFailedBanner"),
    insertAsset: k("insertAsset"),
    insertAssetTitle: k(`insertAssetTitle.${kind}`),
    assetInserted: k("assetInserted"),
    assetInsertFailed: k("assetInsertFailed"),
    backToList: k("backToList"),
    historyEmpty: k(`historyEmpty.${kind}`),
    reverted: k("reverted"),
    revertFailed: k(`revertFailed.${kind}`),
  };
};
