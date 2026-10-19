// 日期時間依目前介面語系顯示；不要在模組載入時固定 formatter，切換語言後才會立即更新。
export const formatDateTime = (value: Date, language: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(value);

// 媒體提案與一般資產資訊共用相同的檔案大小格式。
export function formatBytes(value?: number) {
  if (value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
