import { createContext, useContext } from "react";
import type { Project } from "@writer/lib/backend.ts";

// 工作台目前的專案（含公開狀態、slug、分享 token）；側邊列與「全部…」列表的 ⋮ 選單組「在網站上開啟」網址要用。
export const WorkspaceProjectContext = createContext<Project | null>(null);
export const useWorkspaceProject = () => useContext(WorkspaceProjectContext);
