import { createContext, useContext } from "react";

export interface StorytellerReaderHeaderContext {
  projectName: string;
  title: string;
  summary?: string;
  // 專案封面（已依年齡確認 cookie 過濾），有的話鋪成固定 header 那一條的背景
  coverUrl?: string;
  // 封面裁切時要保留的焦點，正規化座標（0～1）；跟作品首頁 Hero 用同一個值。
  coverFocalPoint?: { x: number; y: number };
  visible: boolean;
}

interface StorytellerHeaderContextValue {
  reader?: StorytellerReaderHeaderContext;
  setReader: (reader?: StorytellerReaderHeaderContext) => void;
}

export const StorytellerHeaderContext =
  createContext<StorytellerHeaderContextValue>({
    setReader: () => undefined,
  });

/** 閱讀頁用這個 slot 把捲動 context 交給共用 Header，不另外疊一條 fixed bar。 */
export function useStorytellerHeaderContext() {
  return useContext(StorytellerHeaderContext);
}
