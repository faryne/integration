// 日期時間統一用台灣格式顯示（專案卡片、編輯區、編輯歷史共用）。
export const dateTimeFormat = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" });

// 媒體提案與一般資產資訊共用相同的檔案大小格式。
export function formatBytes(value?: number) {
  if (value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
