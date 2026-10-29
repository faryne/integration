import { MenuItem, TextField } from "@mui/material";
import { allTwAreas } from "@/components/twstats/twStatsUrlState.ts";
import { TWAreaMappings } from "@/types/twstats.ts";

const counties = allTwAreas.filter((area) => area !== "Taiwan");

type Props = {
  value: string;
  onChange: (value: string) => void;
  // 有給時多一個空值選項（例如「全部縣市」）
  emptyLabel?: string;
};

export function TwStatsCountySelect({ value, onChange, emptyLabel }: Props) {
  return (
    <TextField
      select
      size={"small"}
      label={"縣市"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // 空值也要顯示選項文字（例如「全部縣市」），label 需固定縮在上方才不會蓋住
      slotProps={{
        select: { displayEmpty: emptyLabel !== undefined },
        inputLabel: { shrink: emptyLabel !== undefined || value !== "" },
      }}
      sx={{ minWidth: 160 }}
    >
      {emptyLabel !== undefined && <MenuItem value={""}>{emptyLabel}</MenuItem>}
      {counties.map((area) => (
        <MenuItem key={area} value={area}>
          {TWAreaMappings[area]}
        </MenuItem>
      ))}
    </TextField>
  );
}
