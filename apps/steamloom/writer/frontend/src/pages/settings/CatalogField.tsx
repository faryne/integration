import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { backend, errorMessage, type CatalogItem, type WorkerAdapter } from "@writer/lib/backend.ts";

type SettingField = WorkerAdapter["fields"][number];

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

// CatalogField 是「常用清單」設定欄位（kind === "catalog"）：貼網址交給後端 adapter 解析成一項（ID＋預設名稱），
// 名稱可直接改；field.item_weight 時每項另有 0～1 權重。整份清單以 JSON 字串存回 settings。
export function CatalogField({ adapterID, field, value, error, onChange }: {
  adapterID: string;
  field: SettingField;
  value: string | undefined;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const items = useMemo(() => parseCatalogValue(value), [value]);
  const [url, setURL] = useState("");
  const [addError, setAddError] = useState("");
  const [resolving, setResolving] = useState(false);
  const commit = (next: CatalogItem[]) => onChange(JSON.stringify(next));
  const update = (index: number, patch: Partial<CatalogItem>) => commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const add = async () => {
    if (!url.trim() || resolving) return;
    setResolving(true);
    setAddError("");
    try {
      const item = await backend.ResolveWorkerCatalogItem(adapterID, field.key, url);
      // 沒帶版本的網址要等後端解析出版本 ID 才知道是否重複
      if (items.some((existing) => existing.id === item.id)) {
        setAddError(t("settings.workers.catalogDuplicate"));
        return;
      }
      commit([...items, item]);
      setURL("");
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Paper variant="outlined">
      <Typography fontWeight={600} sx={{ px: 1.75, py: 1.25, borderBottom: 1, borderColor: "divider" }}>{field.label}</Typography>
      <Stack direction="row" gap={1} alignItems="flex-start" sx={{ px: 1.75, py: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={field.placeholder}
          value={url}
          disabled={resolving}
          error={Boolean(addError)}
          helperText={addError || undefined}
          onChange={(event) => { setURL(event.target.value); setAddError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") void add(); }}
        />
        <Button variant="contained" disabled={!url.trim() || resolving} onClick={() => void add()} sx={{ flex: "none", minWidth: 72 }}>
          {resolving ? <CircularProgress size={16} color="inherit" /> : t("settings.workers.catalogAdd")}
        </Button>
      </Stack>
      {items.map((item, index) => (
        <Stack key={item.id} direction="row" gap={1.25} alignItems="center" sx={{ px: 1.75, py: 1, borderTop: 1, borderColor: "divider" }}>
          <TextField size="small" label={t("settings.workers.catalogName")} value={item.name} error={!item.name.trim()} onChange={(event) => update(index, { name: event.target.value })} sx={{ flex: 1, minWidth: 0 }} />
          <Tooltip title={item.id}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ width: 150, fontFamily: "monospace" }}>{item.id}</Typography>
          </Tooltip>
          {field.item_weight && (
            <TextField
              size="small"
              type="number"
              label={t("settings.workers.catalogWeight")}
              value={item.weight}
              error={!(item.weight >= 0 && item.weight <= 1)}
              slotProps={{ htmlInput: { min: 0, max: 1, step: 0.05 } }}
              onChange={(event) => update(index, { weight: event.target.value === "" ? Number.NaN : Number(event.target.value) })}
              sx={{ width: 96, flex: "none" }}
            />
          )}
          <IconButton size="small" color="error" aria-label={t("settings.workers.catalogRemove")} onClick={() => commit(items.filter((_, i) => i !== index))}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      {error && <Box sx={{ px: 1.75, pb: 1.25, color: "error.main", fontSize: 12 }}>{error}</Box>}
    </Paper>
  );
}
