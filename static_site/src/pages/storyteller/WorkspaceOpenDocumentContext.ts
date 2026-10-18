import { createContext, useContext } from "react";

// 編輯器裡要「切到另一篇編輯」時（例如註解參照卡的「開啟編輯」）由工作台決定怎麼切：
// 網站工作台換路由、Writer 換選取的文件；兩邊都會先走未存檔確認（含「存檔並繼續」）。
// 沒有 provider（例如 wysiwyg-demo）就不顯示這個入口。
export type WorkspaceOpenDocument = (target: {
  kind: "story" | "lore";
  publicId: string;
  isImage?: boolean;
}) => void;

const WorkspaceOpenDocumentContext =
  createContext<WorkspaceOpenDocument | null>(null);

export const WorkspaceOpenDocumentProvider =
  WorkspaceOpenDocumentContext.Provider;

export const useWorkspaceOpenDocument = () =>
  useContext(WorkspaceOpenDocumentContext);
