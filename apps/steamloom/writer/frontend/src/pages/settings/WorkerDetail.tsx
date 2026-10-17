import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, Stack, Switch, TextField, Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaWorker, WorkerAdapter, WorkerSaveInput } from "@writer/lib/backend.ts";
import { workerInputErrors } from "@writer/pages/settings/workerValidation.ts";

const blankInput = (adapter: WorkerAdapter, worker?: MediaWorker): WorkerSaveInput => ({
  id: worker?.id ?? "",
  adapter_id: adapter.id,
  name: worker?.name ?? adapter.name,
  enabled: worker?.enabled ?? true,
  settings: Object.fromEntries(adapter.fields.filter((field) => !field.secret).map((field) => [field.key, worker?.settings[field.key] ?? field.default ?? ""])),
  secrets: {},
  clear_secrets: [],
});

export function WorkerDetail({ adapter, worker, busy, onSave, onTest, onDelete }: {
  adapter: WorkerAdapter;
  worker?: MediaWorker;
  busy: "save" | "test" | "delete" | null;
  onSave: (input: WorkerSaveInput) => void;
  onTest: (input: WorkerSaveInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState<WorkerSaveInput>(() => blankInput(adapter, worker));
  // touched 記錄作者碰過的欄位：一開表單不先滿版紅字，離開欄位後才顯示該欄錯誤。
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setInput(blankInput(adapter, worker));
    setTouched({});
  }, [adapter, worker]);
  const errors = useMemo(() => workerInputErrors(adapter, input, worker), [adapter, input, worker]);
  const invalid = Object.keys(errors).length > 0;
  const fieldError = (key: string) => touched[key] && errors[key] ? t(errors[key]) : undefined;
  const touch = (key: string) => setTouched((current) => ({ ...current, [key]: true }));
  const updateSetting = (key: string, value: string, secret: boolean) => setInput((current) => ({
    ...current,
    [secret ? "secrets" : "settings"]: { ...current[secret ? "secrets" : "settings"], [key]: value },
    clear_secrets: secret ? current.clear_secrets.filter((item) => item !== key) : current.clear_secrets,
  }));

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 3, maxWidth: 820 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontSize: 19 }}>{input.name || adapter.name}</Typography>
          <Typography color="text.secondary" variant="body2">{adapter.description}</Typography>
        </Box>
        <FormControlLabel sx={{ flex: "none", ml: 2, mr: 0, whiteSpace: "nowrap" }} control={<Switch checked={input.enabled} onChange={(_, enabled) => setInput({ ...input, enabled })} />} label={t("settings.workers.enabled")} />
      </Stack>

      {worker?.status === "error" && <Alert severity="error" sx={{ mb: 2 }}>{worker.status_message}</Alert>}
      {worker?.status === "online" && <Alert severity="success" sx={{ mb: 2 }}>{worker.status_message || t("settings.workers.status.online")}</Alert>}

      <Stack spacing={2.25}>
        <TextField label={t("settings.workers.name")} value={input.name} required error={Boolean(fieldError("name"))} helperText={fieldError("name")} onBlur={() => touch("name")} onChange={(event) => setInput({ ...input, name: event.target.value })} />
        <TextField label={t("settings.workers.adapter")} value={adapter.name} disabled />
        <Typography fontWeight={600} sx={{ pt: 1 }}>{t("settings.workers.connection")}</Typography>
        {adapter.fields.map((field) => (
          <Box key={field.key}>
            <TextField
              fullWidth
              required={field.required}
              type={field.secret ? "password" : field.kind === "url" ? "url" : "text"}
              label={field.label}
              placeholder={field.secret && worker?.has_secrets[field.key] ? t("settings.workers.secretStored") : field.placeholder}
              value={field.secret ? input.secrets[field.key] ?? "" : input.settings[field.key] ?? ""}
              error={Boolean(fieldError(field.key))}
              helperText={fieldError(field.key)}
              onBlur={() => touch(field.key)}
              onChange={(event) => updateSetting(field.key, event.target.value, field.secret)}
            />
            {field.secret && worker?.has_secrets[field.key] && (
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={input.clear_secrets.includes(field.key)} onChange={(_, checked) => { touch(field.key); setInput({ ...input, clear_secrets: checked ? [...input.clear_secrets, field.key] : input.clear_secrets.filter((item) => item !== field.key), secrets: { ...input.secrets, [field.key]: "" } }); }} />}
                label={<Typography variant="caption">{t("settings.workers.clearSecret", { label: field.label })}</Typography>}
              />
            )}
          </Box>
        ))}

        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>{t("settings.workers.capabilities")}</Typography>
          {worker?.capabilities?.length ? (
            <Stack direction="row" gap={1} flexWrap="wrap">
              {worker.capabilities.map((capability) => <Chip key={capability} label={t(`settings.workers.capability.${capability}`, { defaultValue: capability })} />)}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">{t("settings.workers.noCapabilities")}</Typography>
          )}
        </Box>

        <Stack direction="row" gap={1.25} sx={{ pt: 2 }}>
          <Button variant="contained" startIcon={busy === "save" ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} disabled={busy !== null || invalid} onClick={() => onSave(input)}>
            {busy === "save" ? t("settings.workers.saving") : t("settings.workers.save")}
          </Button>
          <Button variant="outlined" startIcon={busy === "test" ? <CircularProgress size={16} /> : <NetworkCheckIcon />} disabled={busy !== null || invalid} onClick={() => onTest(input)}>
            {busy === "test" ? t("settings.workers.testing") : t("settings.workers.test")}
          </Button>
          <Box sx={{ flex: 1 }} />
          {onDelete && <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={busy !== null} onClick={onDelete}>{t("settings.workers.delete")}</Button>}
        </Stack>
      </Stack>
    </Box>
  );
}
