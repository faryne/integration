import RefreshIcon from "@mui/icons-material/Refresh";
import { CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Tooltip } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type CodexModel } from "@writer/lib/backend.ts";

export interface CodexExecutionProfile {
  model: string;
  reasoningEffort: string;
}

// Codex 是目前唯一開放 model / effort 的 adapter；選項完全來自本機 app-server。
export function CodexExecutionControls({ value, disabled, onChange }: {
  value: CodexExecutionProfile;
  disabled: boolean;
  onChange: (value: CodexExecutionProfile) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [models, setModels] = useState<CodexModel[] | null>(null);

  const load = useCallback(async () => {
    setModels(null);
    try {
      setModels(await backend.CodexModels());
    } catch (err) {
      showError(errorMessage(err));
      setModels([]); // 讓問答仍可回退使用 Codex 預設，不被 picker 故障擋下。
    }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => models?.find((model) => model.id === value.model), [models, value.model]);
  const efforts = selected?.supported_reasoning_efforts ?? [];

  useEffect(() => {
    if (!models?.length) return;
    const model = selected ?? models.find((item) => item.is_default) ?? models[0];
    const effort = model.supported_reasoning_efforts.some((item) => item.id === value.reasoningEffort)
      ? value.reasoningEffort
      : model.default_reasoning_effort;
    if (model.id !== value.model || effort !== value.reasoningEffort) onChange({ model: model.id, reasoningEffort: effort });
  }, [models, onChange, selected, value.model, value.reasoningEffort]);

  const modelValue = selected?.id ?? "";
  const effortValue = efforts.some((effort) => effort.id === value.reasoningEffort) ? value.reasoningEffort : "";
  return (
    <>
      <FormControl size="small" sx={{ minWidth: 190 }} disabled={disabled || models === null}>
        <InputLabel id="codex-model-label">{t("workspace.chat.codexModel")}</InputLabel>
        <Select
          labelId="codex-model-label"
          label={t("workspace.chat.codexModel")}
          value={modelValue}
          onChange={(event) => {
            const model = models?.find((item) => item.id === event.target.value);
            if (model) onChange({ model: model.id, reasoningEffort: model.default_reasoning_effort });
          }}
          sx={{ fontSize: 12.5, "& .MuiSelect-select": { py: 0.5 } }}
        >
          {models === null && <MenuItem value="">{t("workspace.chat.codexModelsLoading")}</MenuItem>}
          {models?.length === 0 && <MenuItem value="">Codex {t("workspace.chat.codexModelDefault")}</MenuItem>}
          {models?.map((model) => (
            <MenuItem key={model.id} value={model.id} title={model.description} sx={{ fontSize: 13 }}>
              {model.display_name}{model.is_default ? ` (${t("workspace.chat.codexModelDefault")})` : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 145 }} disabled={disabled || !selected || efforts.length === 0}>
        <InputLabel id="codex-effort-label">{t("workspace.chat.codexEffort")}</InputLabel>
        <Select
          labelId="codex-effort-label"
          label={t("workspace.chat.codexEffort")}
          value={effortValue}
          onChange={(event) => onChange({ ...value, reasoningEffort: event.target.value })}
          sx={{ fontSize: 12.5, "& .MuiSelect-select": { py: 0.5 } }}
        >
          {efforts.map((effort) => (
            <MenuItem key={effort.id} value={effort.id} title={effort.description} sx={{ fontSize: 13, textTransform: "capitalize" }}>
              {effort.id}{effort.id === selected?.default_reasoning_effort ? ` (${t("workspace.chat.codexEffortDefault")})` : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title={t("workspace.chat.codexModelsRefresh")}>
        <span>
          <IconButton size="small" disabled={disabled || models === null} aria-label={t("workspace.chat.codexModelsRefresh")} onClick={() => void load()}>
            {models === null ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}
