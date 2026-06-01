import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { Link, useParams } from "react-router-dom";
import {
  type TwStatsByYear,
  useGetTwStatsByName,
} from "@/apis/opendata/twstats.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";
import { useEffect, useMemo, useState } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { LineChart, type LineSeries } from "@mui/x-charts/LineChart";

const allAreas = Object.keys(TWAreaMappings) as TWArea[];
const sixCityAreas: TWArea[] = [
  "Taipei",
  "NewTaipei",
  "Taoyuan",
  "Taichung",
  "Tainan",
  "Kaohsiung",
];
const offshoreAreas: TWArea[] = ["Penghu", "Kinmen", "Matsu"];

const areaPresets: Array<{ label: string; areas: TWArea[] }> = [
  {
    label: "除台灣之外所有縣市",
    areas: allAreas.filter((area) => area !== "Taiwan"),
  },
  { label: "僅台灣", areas: ["Taiwan"] },
  { label: "僅六都", areas: sixCityAreas },
  { label: "原臺灣省轄市", areas: ["Keelung", "HsinchuCity", "ChiaYiCity"] },
  {
    label: "台灣省下轄縣",
    areas: allAreas.filter(
      (area) =>
        TWAreaMappings[area].includes("縣") &&
        area !== "Kinmen" &&
        area !== "Matsu",
    ),
  },
  { label: "福建省下轄縣", areas: ["Kinmen", "Matsu"] },
  { label: "離島縣", areas: offshoreAreas },
];

function groupNumbers(start: number, end: number) {
  const groups: number[][] = [];
  let currentGroup: number[] = [];

  for (let year = start; year <= end; year += 1) {
    currentGroup.push(year);

    if (year % 5 === 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

const getSortedYears = (data?: TwStatsByYear) =>
  Object.keys(data ?? {}).sort((a, b) => Number(a) - Number(b));

const parseStatValue = (value: string | undefined) => {
  if (!value || value === "-") {
    return null;
  }

  const parsed = Number.parseFloat(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export function TwStatsByName() {
  const { name = "" } = useParams();
  const statsQuery = useGetTwStatsByName(name);
  const [chooseAreas, setChooseAreas] = useState<TWArea[]>(allAreas);
  const [chooseYears, setChooseYears] = useState<string[]>([]);

  useTitle("台灣指標" + (name ? " - " + name : ""));

  const years = useMemo(
    () => getSortedYears(statsQuery.data),
    [statsQuery.data],
  );
  const selectedYearSet = useMemo(() => new Set(chooseYears), [chooseYears]);
  const selectedYears = useMemo(
    () => years.filter((year) => selectedYearSet.has(year)),
    [selectedYearSet, years],
  );
  const yearGroups = useMemo(() => {
    if (years.length === 0) {
      return [];
    }

    return groupNumbers(Number(years[0]), Number(years[years.length - 1]));
  }, [years]);
  const meta = useMemo(() => {
    const firstYear = years[0];
    return firstYear ? statsQuery.data?.[firstYear] : undefined;
  }, [statsQuery.data, years]);
  const lineChartSeries = useMemo<LineSeries[]>(
    () =>
      chooseAreas.map((area) => ({
        label: TWAreaMappings[area],
        data: selectedYears.map((year) =>
          parseStatValue(statsQuery.data?.[year]?.[area]),
        ),
      })),
    [chooseAreas, selectedYears, statsQuery.data],
  );

  useEffect(() => {
    setChooseYears(years);
  }, [years]);

  const toggleYear = (year: string) => {
    setChooseYears((current) =>
      current.includes(year)
        ? current.filter((selectedYear) => selectedYear !== year)
        : [...current, year].sort((a, b) => Number(a) - Number(b)),
    );
  };

  const toggleArea = (area: TWArea) => {
    setChooseAreas((current) =>
      current.includes(area)
        ? current.filter((selectedArea) => selectedArea !== area)
        : [...current, area],
    );
  };

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label={"breadcrumb"}>
        <Link to={"/"}>首頁</Link>
        <Link to={"/data/tw-stats"}>台灣指標</Link>
        <Typography color={"text.primary"}>{name}</Typography>
      </Breadcrumbs>

      <Stack spacing={1}>
        <Typography variant={"h3"} component={"h1"}>
          {name}
        </Typography>
        {meta?.Explain && (
          <Typography color={"text.secondary"}>{meta.Explain}</Typography>
        )}
        {meta?.Unit && (
          <Typography variant={"body2"} color={"text.secondary"}>
            單位：{meta.Unit}
          </Typography>
        )}
        <Typography
          variant={"body2"}
          color={"text.secondary"}
          sx={{ overflowWrap: "anywhere" }}
        >
          資料網址：
          <Box component={"code"}>
            https://raw.githubusercontent.com/faryne/tw-stats/master/docs/
            {name}/index.json
          </Box>
        </Typography>
      </Stack>

      {statsQuery.isLoading && (
        <Stack direction={"row"} spacing={1.5} alignItems={"center"}>
          <CircularProgress size={22} />
          <Typography color={"text.secondary"}>載入指標資料中</Typography>
        </Stack>
      )}

      {statsQuery.isError && (
        <Alert severity={"error"}>指標資料載入失敗，請稍後再試。</Alert>
      )}

      {statsQuery.isSuccess && years.length === 0 && (
        <Alert severity={"info"}>此指標目前沒有可顯示的年度資料。</Alert>
      )}

      {statsQuery.isSuccess && years.length > 0 && (
        <Stack spacing={2.5}>
          <Paper variant={"outlined"} sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography fontWeight={700}>年份</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 10 }}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={"row"}
                      spacing={1}
                      flexWrap={"wrap"}
                      useFlexGap
                    >
                      <Button
                        variant={"outlined"}
                        startIcon={<RestartAltIcon />}
                        onClick={() => setChooseYears(years)}
                      >
                        全部年份
                      </Button>
                      {yearGroups.map((group) => (
                        <Button
                          variant={"outlined"}
                          key={`${group[0]}-${group[group.length - 1]}`}
                          onClick={() => setChooseYears(group.map(String))}
                        >
                          {group[0]}~{group[group.length - 1]}
                        </Button>
                      ))}
                    </Stack>
                    <Stack
                      direction={"row"}
                      spacing={0.75}
                      flexWrap={"wrap"}
                      useFlexGap
                    >
                      {years.map((year) => (
                        <Chip
                          key={year}
                          label={year}
                          color={
                            selectedYearSet.has(year) ? "primary" : "default"
                          }
                          variant={
                            selectedYearSet.has(year) ? "filled" : "outlined"
                          }
                          onClick={() => toggleYear(year)}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography fontWeight={700}>所屬區域</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 10 }}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={"row"}
                      spacing={1}
                      flexWrap={"wrap"}
                      useFlexGap
                    >
                      <Button
                        variant={"outlined"}
                        startIcon={<RestartAltIcon />}
                        onClick={() => setChooseAreas(allAreas)}
                      >
                        全部區域
                      </Button>
                      {areaPresets.map((preset) => (
                        <Button
                          key={preset.label}
                          variant={"outlined"}
                          onClick={() => setChooseAreas(preset.areas)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </Stack>
                    <Stack
                      direction={"row"}
                      spacing={0.75}
                      flexWrap={"wrap"}
                      useFlexGap
                    >
                      {allAreas.map((area) => (
                        <Chip
                          key={area}
                          color={
                            chooseAreas.includes(area) ? "primary" : "default"
                          }
                          label={TWAreaMappings[area]}
                          variant={
                            chooseAreas.includes(area) ? "filled" : "outlined"
                          }
                          onClick={() => toggleArea(area)}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {selectedYears.length === 0 || chooseAreas.length === 0 ? (
            <Alert severity={"info"}>請至少選擇一個年份與一個區域。</Alert>
          ) : (
            <>
              <Paper variant={"outlined"} sx={{ p: 1 }}>
                <LineChart
                  height={420}
                  series={lineChartSeries}
                  xAxis={[
                    {
                      scaleType: "band",
                      data: selectedYears.map((year) => `${year}年`),
                    },
                  ]}
                  margin={{ left: 72, right: 24, top: 24, bottom: 48 }}
                />
              </Paper>

              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <TableContainer component={Paper} variant={"outlined"}>
                  <Table size={"small"} stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>年份</TableCell>
                        {chooseAreas.map((area) => (
                          <TableCell key={area} align={"right"}>
                            {TWAreaMappings[area]}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedYears.map((year) => (
                        <TableRow key={year} hover>
                          <TableCell
                            component={"th"}
                            scope={"row"}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {year}
                          </TableCell>
                          {chooseAreas.map((area) => (
                            <TableCell
                              key={`${year}-${area}`}
                              align={"right"}
                              sx={{ whiteSpace: "nowrap" }}
                            >
                              {statsQuery.data?.[year]?.[area] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}
