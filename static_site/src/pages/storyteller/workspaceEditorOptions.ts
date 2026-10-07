import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { createElement, type ReactNode } from "react";

// 編輯頁屬性按鈕（ProjectWorkspaceEditorControls.tsx）的選項型別與顯示文字；
// 獨立成 .ts 是因為元件檔只能 export 元件（react-refresh 規則）。

export interface WorkspaceEditorSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

// 屬性按鈕與手機版收合摘要共用的「目前選到什麼」文字
export const selectedOptionLabel = (
  options: WorkspaceEditorSelectOption[],
  value: string,
) => options.find((option) => option.value === value)?.label ?? "未設定";

export const selectedOptionsLabel = (
  options: WorkspaceEditorSelectOption[],
  values: string[],
) =>
  options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)
    .join("、") || "未設定";

// 故事與設定共用的公開狀態選項（draft＝只有作者看得到、completed＝讀者看得到）
export type PublicationStatus = "draft" | "completed";

export const publicationStatusOptions: WorkspaceEditorSelectOption[] = [
  {
    value: "draft",
    label: "未公開",
    icon: createElement(VisibilityOffIcon, { fontSize: "small" }),
  },
  {
    value: "completed",
    label: "公開中",
    icon: createElement(VisibilityIcon, { fontSize: "small" }),
  },
];
