import { createContext, useContext } from "react";
import type { StorytellerAsset, StorytellerLore } from "@/types/storyteller.ts";

// 編輯器（連結對話框、設定連結提示、資產圖片）需要的資料，由外層注入而不是直接呼叫網站 API：
// 網站用 react-query hook（見 apis/storyteller/editorData.ts，掛在 StorytellerLayout），
// SteamLoom Writer 桌面版走 Go 綁定。這樣編輯器本體不會把 axios／登入狀態一起拖進 Writer。
// 兩個欄位本身就是 hook，provider 的 value 要是固定物件（模組層常數），否則 hook 順序會亂。
// 型別只列編輯器真的用到的欄位，Writer 端不用湊出整份 StorytellerLore／StorytellerAsset。
export type EditorLore = Pick<
  StorytellerLore,
  "public_id" | "title" | "status"
>;
export type EditorAsset = Pick<
  StorytellerAsset,
  "preview_url" | "title" | "original_filename"
>;
export interface StorytellerEditorData {
  useLores: (projectPublicId?: string) => {
    data?: EditorLore[];
    isSuccess: boolean;
    isLoading: boolean;
  };
  useAsset: (
    projectPublicId?: string,
    assetPublicId?: string,
  ) => { data?: EditorAsset; isLoading: boolean };
}

// 沒有 provider（例如 wysiwyg-demo、單元測試）時當作沒有資料：設定清單不載入、圖片只用節點上的 src
const emptyEditorData: StorytellerEditorData = {
  useLores: () => ({ data: undefined, isSuccess: false, isLoading: false }),
  useAsset: () => ({ data: undefined, isLoading: false }),
};

export const StorytellerEditorDataContext =
  createContext<StorytellerEditorData>(emptyEditorData);

export const useEditorLores = (projectPublicId?: string) =>
  useContext(StorytellerEditorDataContext).useLores(projectPublicId);
export const useEditorAsset = (
  projectPublicId?: string,
  assetPublicId?: string,
) =>
  useContext(StorytellerEditorDataContext).useAsset(
    projectPublicId,
    assetPublicId,
  );
