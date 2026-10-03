import AutorenewIcon from "@mui/icons-material/Autorenew";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import NotesIcon from "@mui/icons-material/Notes";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import UpdateIcon from "@mui/icons-material/Update";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import dayjs from "dayjs";
import type { WorkspaceEditorStatusItem } from "./ProjectWorkspaceEditorControls.tsx";

// 故事與設定編輯器（雙胞胎）共用的狀態項目：字數、公開狀態（只有獨立頁）、更新時間、自動存檔。
// 畫面上只有 icon，數值都在 detail（hover／點擊顯示）；還沒存過檔時改顯示「尚未存檔」。
export function editorStatusItems({
  wordCount,
  published,
  updatedAt,
  autoSaveMinutes,
}: {
  wordCount: number;
  // undefined＝不顯示公開狀態（嵌入工作台時頁首已經有）
  published?: boolean;
  updatedAt?: string;
  // undefined＝不顯示自動存檔（沒有專案資料時）；null＝關閉
  autoSaveMinutes?: number | null;
}): WorkspaceEditorStatusItem[] {
  const items: WorkspaceEditorStatusItem[] = [
    { icon: <NotesIcon />, detail: `${wordCount.toLocaleString()} 字` },
  ];
  if (published !== undefined) {
    items.push({
      icon: published ? <VisibilityIcon /> : <VisibilityOffIcon />,
      detail: published ? "公開中：讀者看得到這一篇" : "未公開：只有你看得到",
    });
  }
  if (!updatedAt) {
    items.push({
      icon: <ErrorOutlineIcon />,
      detail: "尚未存檔",
      tone: "warning",
    });
    return items;
  }
  items.push({
    icon: <UpdateIcon />,
    detail: `更新於 ${dayjs(updatedAt).format("YYYY/MM/DD HH:mm:ss")}`,
  });
  if (autoSaveMinutes !== undefined) {
    items.push(
      autoSaveMinutes === null
        ? { icon: <SyncDisabledIcon />, detail: "自動存檔已關閉" }
        : {
            icon: <AutorenewIcon />,
            detail: `每 ${autoSaveMinutes} 分鐘自動存檔`,
            tone: "success",
          },
    );
  }
  return items;
}
