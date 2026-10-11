// 日期時間統一用台灣格式顯示（專案卡片、編輯區、編輯歷史共用）。
export const dateTimeFormat = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" });
