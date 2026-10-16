import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import type { AgentProposalItem, WorkerJobSpec } from "@writer/lib/backend.ts";

export function initialMediaJobInputs(spec: WorkerJobSpec, item: AgentProposalItem): Record<string, unknown> {
	const brief: Record<string, unknown> = {
		prompt: item.brief?.prompt,
		negative_prompt: item.brief?.negative_prompt,
		aspect_ratio: item.brief?.aspect_ratio,
		candidate_count: item.brief?.candidate_count,
	};
  return Object.fromEntries(spec.fields.flatMap((field) => {
    const value = brief?.[field.key] ?? field.default;
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
  const update = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  return (
    <Stack spacing={2}>
      <Typography fontWeight={700}>{spec.worker_name}</Typography>
      {spec.fields.map((field) => field.kind === "boolean" ? (
        <FormControlLabel
          key={field.key}
          control={<Switch checked={Boolean(values[field.key])} disabled={disabled} onChange={(event) => update(field.key, event.target.checked)} />}
          label={field.label}
        />
      ) : (
        <TextField
          key={field.key}
          label={field.label}
          value={values[field.key] ?? ""}
          required={field.required}
          disabled={disabled}
          multiline={field.kind === "textarea"}
          minRows={field.kind === "textarea" ? 3 : undefined}
          select={field.kind === "select"}
          type={field.kind === "number" ? "number" : "text"}
          helperText={field.description}
          slotProps={field.kind === "number" ? { htmlInput: { min: field.min, max: field.max, step: field.step } } : undefined}
          onChange={(event) => update(field.key, field.kind === "number" ? Number(event.target.value) : event.target.value)}
        >
          {field.kind === "select" && field.options?.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
      ))}
    </Stack>
  );
}
