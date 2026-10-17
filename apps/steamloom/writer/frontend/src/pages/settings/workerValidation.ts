import type { CatalogItem, MediaWorker, WorkerAdapter, WorkerSaveInput } from "@writer/lib/backend.ts";

// 放在非元件檔：與 CatalogField 元件同檔匯出會讓 Vite Fast Refresh 失效。
// parseCatalogValue 讀取 settings 裡的清單 JSON；空字串或格式錯誤都當空清單（後端 Save 會再驗證）。
export function parseCatalogValue(value: string | undefined): CatalogItem[] {
  if (!value?.trim()) return [];
  try {
    const items = JSON.parse(value);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

// workerInputErrors 依 adapter 宣告的欄位 schema 驗證設定表單，回傳「欄位 key → i18n 錯誤 key」。
// 名稱用保留 key "name"；secret 欄位在已存密鑰且沒勾選清除時視為已填（留白代表保留原值）。
// 後端 mediaworker.Service.Save 也有同一套檢查，這裡只是讓作者在送出前就看到錯誤。
export function workerInputErrors(adapter: WorkerAdapter, input: WorkerSaveInput, worker?: MediaWorker): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "settings.workers.required";
  for (const field of adapter.fields) {
    const value = (field.secret ? input.secrets[field.key] : input.settings[field.key])?.trim() ?? "";
    const stored = field.secret && Boolean(worker?.has_secrets[field.key]) && !input.clear_secrets.includes(field.key);
    if (field.kind === "catalog") {
      // 常用清單：每項名稱必填；有權重的欄位權重要在 0～1
      const invalid = parseCatalogValue(input.settings[field.key]).some((item) => !item.name?.trim() || (field.item_weight && !(item.weight >= 0 && item.weight <= 1)));
      if (invalid) errors[field.key] = "settings.workers.catalogInvalid";
    } else if (field.required && !value && !stored) errors[field.key] = "settings.workers.required";
    else if (field.kind === "url" && value && !validHTTPURL(value)) errors[field.key] = "settings.workers.invalidUrl";
  }
  return errors;
}

function validHTTPURL(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.host);
  } catch {
    return false;
  }
}
