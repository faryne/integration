import { useTranslation } from "react-i18next";
import type { WorkerAdapter, WorkerJobSpec } from "@writer/lib/backend.ts";

type SettingField = WorkerAdapter["fields"][number];
type JobField = WorkerJobSpec["fields"][number];

const optionKey = (value: string) =>
  value ? value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") : "none";

// Adapter contract 保留穩定 ID 與原始 fallback；畫面文字一律由前端翻譯，新增 adapter 不必改 contract 格式。
export function useWorkerI18n() {
  const { t } = useTranslation();
  return {
    adapterName: (adapter: WorkerAdapter) =>
      t(`settings.workers.adapters.${adapter.id}.name`, {
        defaultValue: adapter.name,
      }),
    adapterDescription: (adapter: WorkerAdapter) =>
      t(`settings.workers.adapters.${adapter.id}.description`, {
        defaultValue: adapter.description,
      }),
    mediaType: (value: string) =>
      t(`settings.workers.mediaTypes.${value}`, { defaultValue: value }),
    settingLabel: (adapterID: string, field: SettingField) =>
      t(`settings.workers.adapters.${adapterID}.fields.${field.key}.label`, {
        defaultValue: field.label,
      }),
    settingPlaceholder: (adapterID: string, field: SettingField) =>
      t(
        `settings.workers.adapters.${adapterID}.fields.${field.key}.placeholder`,
        { defaultValue: field.placeholder },
      ),
    jobLabel: (field: JobField) =>
      t(`settings.workers.jobFields.${field.key}.label`, {
        defaultValue: field.label,
      }),
    jobDescription: (field: JobField) =>
      t(`settings.workers.jobFields.${field.key}.description`, {
        defaultValue: field.description,
      }),
    optionLabel: (field: JobField, value: string, fallback: string) =>
      t(`settings.workers.jobFields.${field.key}.options.${optionKey(value)}`, {
        defaultValue: fallback,
      }),
  };
}
