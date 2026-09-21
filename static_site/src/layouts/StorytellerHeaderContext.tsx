import { createContext, useContext } from "react";

export interface StorytellerReaderHeaderContext {
  projectName: string;
  title: string;
  summary?: string;
  // 專案封面（已依年齡確認 cookie 過濾），有的話鋪成固定 header 那一條的背景
  coverUrl?: string;
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
