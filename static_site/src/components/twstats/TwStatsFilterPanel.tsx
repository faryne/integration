import {
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { type ReactNode, useMemo } from "react";
import { allTwAreas } from "@/components/twstats/twStatsUrlState.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";

const sixCityAreas: TWArea[] = [
  "Taipei",
  "NewTaipei",
  "Taoyuan",
  "Taichung",
  "Tainan",
  "Kaohsiung",
];

const areaPresets: Array<{ label: string; areas: TWArea[] }> = [
  {
    label: "除台灣之外所有縣市",
    areas: allTwAreas.filter((area) => area !== "Taiwan"),
  },
  { label: "僅台灣", areas: ["Taiwan"] },
  { label: "僅六都", areas: sixCityAreas },
  { label: "原臺灣省轄市", areas: ["Keelung", "HsinchuCity", "ChiaYiCity"] },
  {
    label: "台灣省下轄縣",
    areas: allTwAreas.filter(
      (area) =>
        TWAreaMappings[area].includes("縣") &&
        area !== "Kinmen" &&
        area !== "Matsu",
    ),
  },
  { label: "福建省下轄縣", areas: ["Kinmen", "Matsu"] },
  { label: "離島縣", areas: ["Penghu", "Kinmen", "Matsu"] },
];

// 將年份切成每 5 年一組（以尾數 0／5 收尾），給快速選取按鈕用
function groupYears(years: string[]) {
  const groups: string[][] = [];
  let current: string[] = [];
  for (
    let year = Number(years[0]);
    year <= Number(years[years.length - 1]);
    year += 1
  ) {
    current.push(String(year));
    if (year % 5 === 0) {
      groups.push(current);
      current = [];
    }
  }
  return current.length > 0 ? [...groups, current] : groups;
}

function FilterRow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 2 }}>
        <Typography fontWeight={700}>{title}</Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 10 }}>
        <Stack spacing={1.5}>{children}</Stack>
      </Grid>
    </Grid>
  );
}

const ChipRow = ({ children }: { children: ReactNode }) => (
  <Stack direction={"row"} spacing={0.75} flexWrap={"wrap"} useFlexGap>
    {children}
  </Stack>
);

type Props = {
  years: string[];
  selectedYears: string[];
  onYearsChange: (years: string[]) => void;
  selectedAreas: TWArea[];
  onAreasChange: (areas: TWArea[]) => void;
};

// 折線圖／表格用的年份與區域篩選；狀態由頁面持有（同步到網址），這裡只負責呈現
export function TwStatsFilterPanel({
  years,
  selectedYears,
  onYearsChange,
  selectedAreas,
  onAreasChange,
}: Props) {
  const yearGroups = useMemo(
    () => (years.length > 0 ? groupYears(years) : []),
    [years],
  );
  const yearSet = useMemo(() => new Set(selectedYears), [selectedYears]);
  const areaSet = useMemo(() => new Set(selectedAreas), [selectedAreas]);

  const toggleYear = (year: string) =>
    onYearsChange(
      yearSet.has(year)
        ? selectedYears.filter((y) => y !== year)
        : years.filter((y) => yearSet.has(y) || y === year),
    );
  const toggleArea = (area: TWArea) =>
    onAreasChange(
      areaSet.has(area)
        ? selectedAreas.filter((a) => a !== area)
        : allTwAreas.filter((a) => areaSet.has(a) || a === area),
    );

  return (
    <Paper variant={"outlined"} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <FilterRow title={"年份"}>
          <ChipRow>
            <Button
              variant={"outlined"}
              startIcon={<RestartAltIcon />}
              onClick={() => onYearsChange(years)}
            >
              全部年份
            </Button>
            {yearGroups.map((group) => (
              <Button
                variant={"outlined"}
                key={group[0]}
                onClick={() =>
                  onYearsChange(years.filter((year) => group.includes(year)))
                }
              >
                {group[0]}~{group[group.length - 1]}
              </Button>
            ))}
          </ChipRow>
          <ChipRow>
            {years.map((year) => (
              <Chip
                key={year}
                label={year}
                color={yearSet.has(year) ? "primary" : "default"}
                variant={yearSet.has(year) ? "filled" : "outlined"}
                onClick={() => toggleYear(year)}
              />
            ))}
          </ChipRow>
        </FilterRow>

        <Divider />

        <FilterRow title={"所屬區域"}>
          <ChipRow>
            <Button
              variant={"outlined"}
              startIcon={<RestartAltIcon />}
              onClick={() => onAreasChange(allTwAreas)}
            >
              全部區域
            </Button>
            {areaPresets.map((preset) => (
              <Button
                key={preset.label}
                variant={"outlined"}
                onClick={() => onAreasChange(preset.areas)}
              >
                {preset.label}
              </Button>
            ))}
          </ChipRow>
          <ChipRow>
            {allTwAreas.map((area) => (
              <Chip
                key={area}
                label={TWAreaMappings[area]}
                color={areaSet.has(area) ? "primary" : "default"}
                variant={areaSet.has(area) ? "filled" : "outlined"}
                onClick={() => toggleArea(area)}
              />
            ))}
          </ChipRow>
        </FilterRow>
      </Stack>
    </Paper>
  );
}
