import { createContext, useContext } from "react";

const WorkspaceEditorBackContext = createContext<(() => void) | null>(null);

// 編輯器容器提供返回列表的行為，Story/Lore 再決定要把按鈕放在哪個 chrome 區塊。
export const WorkspaceEditorBackProvider = WorkspaceEditorBackContext.Provider;

export function useWorkspaceEditorBack() {
  return useContext(WorkspaceEditorBackContext);
}
