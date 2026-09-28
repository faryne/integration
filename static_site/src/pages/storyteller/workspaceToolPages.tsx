import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import type { ReactNode } from "react";

// 工作台裡「不屬於作品／設定集／資產集任何分組」的專案層頁面。側欄、收合列、麵包屑、
// 標題與路由判斷都從這份清單產生，新增頁面只要加一筆，不必在各處複製 isXxxRoute 判斷。
export type WorkspaceToolPage = "memories";

export interface WorkspaceToolPageDefinition {
  key: WorkspaceToolPage;
  path: string;
  label: string;
  icon: (fontSize?: "small" | "medium") => ReactNode;
}

export const workspaceToolPages: WorkspaceToolPageDefinition[] = [
  {
    key: "memories",
    path: "memories",
    label: "梭梭的記憶",
    icon: (fontSize) => <PsychologyAltOutlinedIcon fontSize={fontSize} />,
  },
];

export function workspaceToolPageFromPath(
  pathname: string,
): WorkspaceToolPageDefinition | undefined {
  return workspaceToolPages.find((page) => pathname.endsWith(`/${page.path}`));
}
