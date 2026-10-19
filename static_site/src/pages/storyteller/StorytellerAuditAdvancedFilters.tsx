import TuneIcon from "@mui/icons-material/Tune";
import {
  Autocomplete,
  Box,
  Button,
  Collapse,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  auditCategoryLabel,
  auditOutcomeLabel,
  auditSourceLabel,
  countActiveAuditFilters,
  emptyAuditAdvancedFilters,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type {
  StorytellerAuditAdvancedFilterValues,
  StorytellerAuditEventFilters,
} from "@/types/storyteller.ts";

type Option = { value: string; label?: string };

// 選項可能很多（專案、Personal Access Token／OAuth 授權），用可輸入搜尋的下拉，而不是整排 chips。
function SearchableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Autocomplete
      size="small"
      options={options}
      value={options.find((option) => option.value === value) ?? null}
      onChange={(_, option) => onChange(option?.value ?? "")}
      getOptionLabel={(option) => option.label || option.value}
      isOptionEqualToValue={(option, selected) =>
        option.value === selected.value
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={t("web.common.all")}
        />
      )}
    />
  );
}

function PlainSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value="">{t("web.common.all")}</MenuItem>
      {options.map(([optionValue, optionLabel]) => (
        <MenuItem key={optionValue} value={optionValue}>
          {optionLabel}
        </MenuItem>
      ))}
    </TextField>
  );
}

// StorytellerAuditAdvancedFilters 是活動紀錄的「進階篩選」：預設收合，只有真的要深查時才展開；
// 收合時按鈕上顯示已套用的條件數量並提供清除。近期列表與封存查詢共用。
export function StorytellerAuditAdvancedFilters({
  value,
  options,
  onChange,
}: {
  value: StorytellerAuditAdvancedFilterValues;
  options?: StorytellerAuditEventFilters;
  onChange: (patch: Partial<StorytellerAuditAdvancedFilterValues>) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveAuditFilters(value);
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {activeCount > 0
            ? t("web.audit.filters.advancedWithCount", { count: activeCount })
            : t("web.audit.filters.advanced")}
        </Button>
        {activeCount > 0 && (
          <Button
            size="small"
            color="inherit"
            onClick={() => onChange(emptyAuditAdvancedFilters)}
          >
            {t("web.audit.filters.clear")}
          </Button>
        )}
      </Stack>
      <Collapse in={open}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 1.5,
            pt: 1.5,
          }}
        >
          <SearchableSelect
            label={t("web.audit.filters.project")}
            value={value.projectPublicId}
            options={options?.projects ?? []}
            onChange={(projectPublicId) => onChange({ projectPublicId })}
          />
          <PlainSelect
            label={t("web.audit.filters.category")}
            value={value.category}
            options={(options?.categories ?? []).map((category) => [
              category,
              auditCategoryLabel(category),
            ])}
            onChange={(category) => onChange({ category })}
          />
          <PlainSelect
            label={t("web.audit.filters.source")}
            value={value.source}
            options={(options?.sources ?? []).map((source) => [
              source,
              auditSourceLabel(source),
            ])}
            onChange={(source) => onChange({ source })}
          />
          <PlainSelect
            label={t("web.audit.filters.outcome")}
            value={value.outcome}
            options={(options?.outcomes ?? []).map((outcome) => [
              outcome,
              auditOutcomeLabel(outcome),
            ])}
            onChange={(outcome) => onChange({ outcome })}
          />
          <SearchableSelect
            label={t("web.audit.filters.credential")}
            value={value.credentialRef}
            options={options?.credentials ?? []}
            onChange={(credentialRef) => onChange({ credentialRef })}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                // 選了類別或憑證時一律包含（後端同樣規則），開關只顯示狀態。
                checked={
                  value.includeLowImportance ||
                  value.category !== "" ||
                  value.credentialRef !== ""
                }
                disabled={value.category !== "" || value.credentialRef !== ""}
                onChange={(event) =>
                  onChange({ includeLowImportance: event.target.checked })
                }
              />
            }
            label={
              <Typography variant="body2">
                {t("web.audit.filters.includeLowImportance")}
              </Typography>
            }
          />
        </Box>
      </Collapse>
    </Box>
  );
}
