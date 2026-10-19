import { Box, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import type { AgentProposal, AgentProposalItem, WorkerJobSpec } from "@writer/lib/backend.ts";
import { useWorkerI18n } from "@writer/pages/settings/workerI18n.ts";

// canRetryMedia：生成失敗的媒體需求可以調整參數重跑；ProposalCard 與 ReviewDialog 共用同一判斷。
export const canRetryMedia = (proposal: AgentProposal) => proposal.status === "apply_failed" && proposal.items.length === 1 && proposal.items[0].proposal_type === "media.brief";

type JobField = WorkerJobSpec["fields"][number];

// fitJobValue 把 Agent brief 的值轉成欄位接受的型別；不合 schema（例如 select 沒有這個選項）就回 undefined 改用預設值，
// 避免表單顯示空白、送出才被後端以「必須是文字／不是可用選項」擋下。
function fitJobValue(field: JobField, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.kind === "select") return field.options?.some((option) => option.value === String(value)) ? String(value) : undefined;
  if (field.kind === "multiselect") {
    // 只保留仍在選項裡的值（例如常用 LoRA 被移除後重跑），並截到 Max 上限
    const picked = (Array.isArray(value) ? value : []).map(String).filter((item) => field.options?.some((option) => option.value === item));
    return picked.length ? picked.slice(0, field.max ?? picked.length) : undefined;
  }
  if (field.kind === "number") {
    const number = Number(value);
    return Number.isFinite(number) && (field.min == null || number >= field.min) && (field.max == null || number <= field.max) ? number : undefined;
  }
  return field.kind === "boolean" ? (typeof value === "boolean" ? value : undefined) : String(value);
}

export function initialMediaJobInputs(spec: WorkerJobSpec, item: AgentProposalItem, current: Record<string, unknown> = {}): Record<string, unknown> {
  const brief: Record<string, unknown> = {
    prompt: item.brief?.prompt,
    negative_prompt: item.brief?.negative_prompt,
    aspect_ratio: item.brief?.aspect_ratio,
    candidate_count: item.brief?.candidate_count,
    // 重跑時優先沿用作者上一次送出的參數，而不是退回 Agent 原始 brief。
    ...item.job_inputs,
    // 切換 Worker 時保留 prompt 等兩邊 schema 都接受的當前輸入。
    ...current,
  };
  return Object.fromEntries(spec.fields.flatMap((field) => {
    const value = fitJobValue(field, brief[field.key]) ?? field.default;
    return value === undefined ? [] : [[field.key, value]];
  }));
}

// MediaJobForm 完全依 Worker discovery schema render；新增 adapter 不必再加一份 provider 專屬頁面。
export function MediaJobForm({ spec, values, disabled, onChange }: {
  spec: WorkerJobSpec;
  values: Record<string, unknown>;
  disabled: boolean;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const workerText = useWorkerI18n();
  const update = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  return (
    <Stack spacing={2}>
      <Typography fontWeight={700}>{spec.worker_name}</Typography>
      {spec.fields.map((field) => field.kind === "multiselect" ? (
        <MultiSelectChips key={field.key} field={field} value={Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []} disabled={disabled} onChange={(next) => update(field.key, next.length ? next : undefined)} />
      ) : field.kind === "boolean" ? (
        <FormControlLabel
          key={field.key}
          control={<Switch checked={Boolean(values[field.key])} disabled={disabled} onChange={(event) => update(field.key, event.target.checked)} />}
          label={workerText.jobLabel(field)}
        />
      ) : (
        <TextField
          key={field.key}
          label={workerText.jobLabel(field)}
          value={values[field.key] ?? ""}
          required={field.required}
          disabled={disabled}
          multiline={field.kind === "textarea"}
          minRows={field.kind === "textarea" ? 3 : undefined}
          select={field.kind === "select"}
          type={field.kind === "number" ? "number" : "text"}
          helperText={workerText.jobDescription(field)}
          slotProps={field.kind === "number" ? { htmlInput: { min: field.min, max: field.max, step: field.step } } : undefined}
          // 數字欄清空時送 undefined 而不是 Number("") 的 0，讓後端套用預設值（例如 seed 留空＝隨機）。
          onChange={(event) => update(field.key, field.kind !== "number" ? event.target.value : event.target.value === "" ? undefined : Number(event.target.value))}
        >
          {field.kind === "select" && field.options?.map((option) => <MenuItem key={option.value} value={option.value}>{workerText.optionLabel(field, option.value, option.label)}</MenuItem>)}
        </TextField>
      ))}
    </Stack>
  );
}

// MultiSelectChips 以可點選的 Chip 呈現多選欄位；達到 field.max 時未選的項目停用。
function MultiSelectChips({ field, value, disabled, onChange }: { field: JobField; value: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  const workerText = useWorkerI18n();
  const full = field.max != null && value.length >= field.max;
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{workerText.jobLabel(field)}{field.max != null ? ` (${value.length}/${field.max})` : ""}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
        {field.options?.map((option) => {
          const selected = value.includes(option.value);
          return (
            <Chip
              key={option.value}
              label={workerText.optionLabel(field, option.value, option.label)}
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              disabled={disabled || (full && !selected)}
              onClick={() => toggle(option.value)}
            />
          );
        })}
      </Stack>
      {field.description && <Typography variant="caption" color="text.secondary">{workerText.jobDescription(field)}</Typography>}
    </Box>
  );
}
