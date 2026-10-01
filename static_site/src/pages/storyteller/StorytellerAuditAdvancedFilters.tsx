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
import {
  auditCategoryLabels,
  auditOutcomeLabels,
  auditSourceLabels,
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
        <TextField {...params} label={label} placeholder="全部" />
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
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value="">全部</MenuItem>
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
          進階篩選{activeCount > 0 ? `（${activeCount}）` : ""}
        </Button>
        {activeCount > 0 && (
          <Button
            size="small"
            color="inherit"
            onClick={() => onChange(emptyAuditAdvancedFilters)}
          >
            清除篩選
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
            label="專案"
            value={value.projectPublicId}
            options={options?.projects ?? []}
            onChange={(projectPublicId) => onChange({ projectPublicId })}
          />
          <PlainSelect
            label="類別"
            value={value.category}
            options={(options?.categories ?? []).map((category) => [
              category,
              auditCategoryLabels[category] ?? category,
            ])}
            onChange={(category) => onChange({ category })}
          />
          <PlainSelect
            label="入口"
            value={value.source}
            options={(options?.sources ?? []).map((source) => [
              source,
              auditSourceLabels[source],
            ])}
            onChange={(source) => onChange({ source })}
          />
          <PlainSelect
            label="結果"
            value={value.outcome}
            options={(options?.outcomes ?? []).map((outcome) => [
              outcome,
              auditOutcomeLabels[outcome],
            ])}
            onChange={(outcome) => onChange({ outcome })}
          />
          <SearchableSelect
            label="憑證"
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
                包含讀取與收藏等低重要度事件
              </Typography>
            }
          />
        </Box>
      </Collapse>
    </Box>
  );
}
