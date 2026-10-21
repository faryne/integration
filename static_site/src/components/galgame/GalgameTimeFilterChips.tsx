import { Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  galgameTimeFilters,
  type GalgameTimeFilter,
} from "@/helpers/galgameTimeFilter.ts";

/** 時間篩選 chips（全部／7 天內／30 天內），首頁與品牌頁共用 */
export function GalgameTimeFilterChips({
  value,
  onChange,
}: {
  value: GalgameTimeFilter;
  onChange: (value: GalgameTimeFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      spacing={1}
      role="group"
      aria-label={t("galgame.timeFilter.ariaLabel")}
    >
      {galgameTimeFilters.map((item) => (
        <Chip
          key={item}
          label={t(`galgame.timeFilter.${item}`)}
          color={value === item ? "primary" : "default"}
          variant={value === item ? "filled" : "outlined"}
          onClick={() => onChange(item)}
        />
      ))}
    </Stack>
  );
}
