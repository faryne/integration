import { Autocomplete, TextField } from "@mui/material";
import type { ActressTopicOption } from "@/types/avActressTopic.ts";
import { renderCountOption } from "@/components/av/option_count.tsx";

/**
 * 主題條件的自動完成（出身地、類型共用）：選項來自 facet，附數量、依數量排序，打字可以篩選。
 * 只能從選項裡選；已經存進條件、但這週 facet 沒有的值（例如標籤被改名）照樣顯示並標「目前沒有資料」
 */
export function ActressTopicOptionAutocomplete({
  label,
  unit,
  options,
  loading,
  value,
  onChange,
  multiple = false,
}: {
  label: string;
  /** 數量的單位：「位」或「部」 */
  unit: string;
  options?: ActressTopicOption[];
  loading?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
}) {
  const counts = new Map((options ?? []).map((o) => [o.value, o.count]));
  const values = [
    ...(options ?? []).map((o) => o.value),
    ...value.filter((v) => v && !counts.has(v)),
  ];
  const common = {
    options: values,
    loading,
    loadingText: "讀取選項中…",
    noOptionsText: "沒有符合的選項",
    renderOption: renderCountOption(counts, unit, "目前沒有資料"),
  };
  const input = (params: object) => (
    <TextField {...params} label={label} size="small" />
  );

  return multiple ? (
    <Autocomplete
      {...common}
      filterSelectedOptions
      multiple
      onChange={(_, v) => onChange(v)}
      renderInput={input}
      value={value}
    />
  ) : (
    <Autocomplete
      {...common}
      onChange={(_, v) => onChange(v ? [v] : [])}
      renderInput={input}
      sx={{ flex: 1, minWidth: 0 }}
      value={value[0] || null}
    />
  );
}
