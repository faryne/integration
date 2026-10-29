import {
  Alert,
  Box,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { useParams } from "react-router-dom";
import {
  type TwStatsByYear,
  useGetTwStatsByName,
} from "@/apis/opendata/twstats.ts";
import { TWAreaMappings } from "@/types/twstats.ts";
import { useCallback, useMemo } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { useUpdateSearchParams } from "@/helpers/useUpdateSearchParams.ts";
import { LineChart, type LineSeries } from "@mui/x-charts/LineChart";
import { TwStatsChoroplethMap } from "@/components/twstats/TwStatsChoroplethMap.tsx";
import { TwStatsFilterPanel } from "@/components/twstats/TwStatsFilterPanel.tsx";
import {
  canPerCapita,
  populationIndicator,
  toPerCapita,
} from "@/components/twstats/twStatsPerCapita.ts";
import {
  decodeAreas,
  decodeYears,
  encodeAreas,
  encodeYears,
  isTwStatsView,
} from "@/components/twstats/twStatsUrlState.ts";
import { parseStatValue } from "@/components/twstats/twStatsValue.ts";

const getSortedYears = (data?: TwStatsByYear) =>
  Object.keys(data ?? {}).sort((a, b) => Number(a) - Number(b));

export function TwStatsByName() {
  const { name = "" } = useParams();
  const [searchParams, updateParams] = useUpdateSearchParams();
  const statsQuery = useGetTwStatsByName(name);

  useTitle("台灣指標" + (name ? " - " + name : ""));

  const years = useMemo(
    () => getSortedYears(statsQuery.data),
    [statsQuery.data],
  );
  const rawMeta = years[0] ? statsQuery.data?.[years[0]] : undefined;

  // 每萬人換算：只有數量／金額類指標可開啟，開啟後才去抓人口指標
  const perCapitaAvailable = canPerCapita(name, rawMeta?.Unit);
  const perCapita = perCapitaAvailable && searchParams.get("per") === "10k";
  const populationQuery = useGetTwStatsByName(populationIndicator, perCapita);
  const data = useMemo(
    () =>
      perCapita && statsQuery.data && populationQuery.data
        ? toPerCapita(statsQuery.data, populationQuery.data)
        : statsQuery.data,
    [perCapita, populationQuery.data, statsQuery.data],
  );
  const unit = years[0] ? data?.[years[0]]?.Unit : undefined;

  // 檢視狀態全部放在網址，分享出去對方看到的就是同一張圖
  const viewParam = searchParams.get("view");
  const view = isTwStatsView(viewParam) ? viewParam : "line";
  const selectedYears = useMemo(
    () => decodeYears(searchParams.get("years"), years) ?? years,
    [searchParams, years],
  );
  const selectedAreas = useMemo(
    () => decodeAreas(searchParams.get("areas")),
    [searchParams],
  );
  const mapYearParam = searchParams.get("year") ?? "";
  const mapYear = years.includes(mapYearParam)
    ? mapYearParam
    : years[years.length - 1];

  const setMapYear = useCallback(
    (year: string) => updateParams({ year }),
    [updateParams],
  );

  const lineChartSeries = useMemo<LineSeries[]>(
    () =>
      selectedAreas.map((area) => ({
        label: TWAreaMappings[area],
        data: selectedYears.map((year) => parseStatValue(data?.[year]?.[area])),
      })),
    [data, selectedAreas, selectedYears],
  );

  const waitingPopulation = perCapita && populationQuery.isLoading;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant={"h3"} component={"h1"}>
          {name}
        </Typography>
        {rawMeta?.Explain && (
          <Typography color={"text.secondary"}>{rawMeta.Explain}</Typography>
        )}
        {unit && (
          <Typography variant={"body2"} color={"text.secondary"}>
            單位：{unit}
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

      {populationQuery.isError && (
        <Alert severity={"error"}>人口資料載入失敗，無法換算每萬人。</Alert>
      )}

      {statsQuery.isSuccess && years.length === 0 && (
        <Alert severity={"info"}>此指標目前沒有可顯示的年度資料。</Alert>
      )}

      {statsQuery.isSuccess && data && years.length > 0 && (
        <Stack spacing={2.5}>
          <Stack
            direction={"row"}
            spacing={2}
            alignItems={"center"}
            flexWrap={"wrap"}
            useFlexGap
          >
            <ToggleButtonGroup
              exclusive
              size={"small"}
              value={view}
              onChange={(_, value) =>
                value && updateParams({ view: value === "line" ? null : value })
              }
            >
              <ToggleButton value={"line"}>
                <ShowChartIcon fontSize={"small"} sx={{ mr: 0.75 }} />
                折線圖
              </ToggleButton>
              <ToggleButton value={"map"}>
                <MapOutlinedIcon fontSize={"small"} sx={{ mr: 0.75 }} />
                地圖
              </ToggleButton>
            </ToggleButtonGroup>
            {perCapitaAvailable && (
              <FormControlLabel
                control={
                  <Switch
                    checked={perCapita}
                    onChange={(_, checked) =>
                      updateParams({ per: checked ? "10k" : null })
                    }
                  />
                }
                label={"換算為每萬人"}
              />
            )}
            {waitingPopulation && <CircularProgress size={20} />}
          </Stack>

          {view === "map" ? (
            <TwStatsChoroplethMap
              data={data}
              years={years}
              year={mapYear}
              unit={unit}
              onYearChange={setMapYear}
            />
          ) : (
            <>
              <TwStatsFilterPanel
                years={years}
                selectedYears={selectedYears}
                onYearsChange={(value) =>
                  updateParams({ years: encodeYears(value, years) })
                }
                selectedAreas={selectedAreas}
                onAreasChange={(value) =>
                  updateParams({ areas: encodeAreas(value) })
                }
              />

              {selectedYears.length === 0 || selectedAreas.length === 0 ? (
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
                            {selectedAreas.map((area) => (
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
                              {selectedAreas.map((area) => (
                                <TableCell
                                  key={`${year}-${area}`}
                                  align={"right"}
                                  sx={{ whiteSpace: "nowrap" }}
                                >
                                  {data[year]?.[area] ?? ""}
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
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}
