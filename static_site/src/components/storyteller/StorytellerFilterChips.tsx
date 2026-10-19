import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// 單選的 filter chips：左側一個標題，「全部」加上各選項；記憶管理與稽核紀錄共用，
// 讓工作台裡所有篩選列長得一樣。
export function StorytellerFilterChips({
  label,
  value,
  options,
  optionDescriptions,
  onChange,
  hideAll,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  optionDescriptions?: Record<string, string>;
  onChange: (value: string) => void;
  // 必選的篩選（例如時間範圍）沒有「全部」可選，由呼叫端關掉。
  hideAll?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
    >
      <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>
        {label}
      </Typography>
      {!hideAll && (
        <Chip
          size="small"
          label={t("web.common.all")}
          color={value === "" ? "primary" : "default"}
          variant={value === "" ? "filled" : "outlined"}
          onClick={() => onChange("")}
        />
      )}
      {options.map(([optionValue, optionLabel]) => {
        const chip = (
          <Chip
            size="small"
            label={optionLabel}
            color={value === optionValue ? "primary" : "default"}
            variant={value === optionValue ? "filled" : "outlined"}
            onClick={() => onChange(optionValue)}
          />
        );
        const description = optionDescriptions?.[optionValue];
        return description ? (
          <Tooltip key={optionValue} title={description} arrow>
            {chip}
          </Tooltip>
        ) : (
          <Box key={optionValue} component="span" sx={{ display: "contents" }}>
            {chip}
          </Box>
        );
      })}
    </Stack>
  );
}
