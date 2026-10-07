import { createContext, type ReactNode } from "react";

// 設定連結（href="steamloom-lore://id"）在閱讀內容裡要怎麼渲染，由外層頁面決定：
// 閱讀頁提供可點擊、會開摘要小卡的渲染方式；沒提供（編輯頁預覽、版本比較等）就當純文字。
// 回傳 null 也代表顯示純文字（例如設定未公開，讀者不該知道那裡有一則設定）。
export type StorytellerLoreLinkRenderer = (
  loreId: string,
  children: ReactNode,
) => ReactNode | null;

export const StorytellerLoreLinkContext =
  createContext<StorytellerLoreLinkRenderer | null>(null);
