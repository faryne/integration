import type { MediaWorker, WorkerAdapter, WorkerSaveInput } from "@writer/lib/backend.ts";

// workerInputErrors 依 adapter 宣告的欄位 schema 驗證設定表單，回傳「欄位 key → i18n 錯誤 key」。
// 名稱用保留 key "name"；secret 欄位在已存密鑰且沒勾選清除時視為已填（留白代表保留原值）。
// 後端 mediaworker.Service.Save 也有同一套檢查，這裡只是讓作者在送出前就看到錯誤。
export function workerInputErrors(adapter: WorkerAdapter, input: WorkerSaveInput, worker?: MediaWorker): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "settings.workers.required";
  for (const field of adapter.fields) {
    const value = (field.secret ? input.secrets[field.key] : input.settings[field.key])?.trim() ?? "";
    const stored = field.secret && Boolean(worker?.has_secrets[field.key]) && !input.clear_secrets.includes(field.key);
    if (field.required && !value && !stored) errors[field.key] = "settings.workers.required";
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
