import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FeatureCollection, Geometry } from "geojson";
import type { TwStatsByYear } from "@/apis/opendata/twstats.ts";
import {
  countyTopologyPath,
  type CountyProperties,
  loadTopology,
  countyPathsWithInsets,
  normalizeAreaName,
  topologyFeatures,
} from "@/components/common/taiwanMapGeo.ts";
import { areaProfileLink } from "@/components/twstats/twStatsFormat.ts";
import { parseStatValue } from "@/components/twstats/twStatsValue.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";

const mapWidth = 480;
const mapHeight = 620;
const playIntervalMs = 700;

// 地圖只畫 22 縣市，「台灣」是彙總值，放在排名上方另外顯示
const countyAreas: TWArea[] = (Object.keys(TWAreaMappings) as TWArea[]).filter(
  (area) => area !== "Taiwan",
);
const areaByCountyName = new Map(
  countyAreas.map((area) => [normalizeAreaName(TWAreaMappings[area]), area]),
);

type Props = {
  data: TwStatsByYear;
  years: string[];
  year: string;
  unit?: string;
  onYearChange: (year: string) => void;
};

export function TwStatsChoroplethMap({
  data,
  years,
  year,
  unit,
  onYearChange,
}: Props) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [counties, setCounties] =
    useState<FeatureCollection<Geometry, CountyProperties>>();
  const [loadError, setLoadError] = useState("");
  const [hovered, setHovered] = useState<TWArea>();
  const [playing, setPlaying] = useState(false);
  // 色階範圍：year＝依當年度拉滿，看當年縣市差異；all＝固定全期間，播放時顏色變化才代表真實增減
  const [scaleMode, setScaleMode] = useState<"year" | "all">("year");

  useEffect(() => {
    loadTopology(countyTopologyPath)
      .then((topology) =>
        setCounties(topologyFeatures<CountyProperties>(topology)),
      )
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : "載入地圖失敗"),
      );
  }, []);

  const paths = useMemo(
    () =>
      counties
        ? countyPathsWithInsets(counties, mapWidth, mapHeight)
        : { main: [], insets: [] },
    [counties],
  );

  const row = data[year];
  const [min, max] = useMemo(() => {
    const rows = scaleMode === "all" ? Object.values(data) : [row];
    const values = rows.flatMap((item) =>
      countyAreas
        .map((area) => parseStatValue(item?.[area]))
        .filter((value) => value !== null),
    );
    return values.length > 0
      ? [Math.min(...values), Math.max(...values)]
      : [0, 0];
  }, [data, row, scaleMode]);

  const ranking = useMemo(
    () =>
      countyAreas
        .map((area) => ({ area, value: parseStatValue(row?.[area]) }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [row],
  );
  const rankOf = useMemo(
    () => new Map(ranking.map((item, index) => [item.area, index + 1])),
    [ranking],
  );

  const fillOf = (value: number | null) =>
    value === null
      ? theme.palette.action.disabledBackground
      : alpha(
          theme.palette.primary.main,
          0.15 + 0.85 * (max === min ? 1 : (value - min) / (max - min)),
        );

  // 播放：每隔固定時間往下一年，到最後一年自動停止；在最後一年按播放則從頭開始
  useEffect(() => {
    if (!playing) {
      return;
    }
    const index = years.indexOf(year);
    if (index >= years.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => onYearChange(years[index + 1]),
      playIntervalMs,
    );
    return () => window.clearTimeout(timer);
  }, [onYearChange, playing, year, years]);

  const togglePlay = () => {
    if (!playing && year === years[years.length - 1]) {
      onYearChange(years[0]);
    }
    setPlaying((current) => !current);
  };

  // 本島與離島小框共用的縣市繪製，hover 時與右側排名互相連動，點擊進入該縣市健檢
  const renderCounty = (countyName: string, path: string) => {
    const area = areaByCountyName.get(normalizeAreaName(countyName));
    const value = area ? parseStatValue(row?.[area]) : null;
    return (
      <path
        key={countyName}
        d={path}
        fill={fillOf(value)}
        style={
          hovered && hovered === area
            ? { stroke: theme.palette.secondary.main, strokeWidth: 2.5 }
            : undefined
        }
        onMouseEnter={() => setHovered(area)}
        onMouseLeave={() => setHovered(undefined)}
        onClick={() => area && navigate(areaProfileLink(area))}
      >
        <title>{`${countyName}：${area ? (row?.[area] ?? "-") : "-"}`}</title>
      </path>
    );
  };

  const yearIndex = Math.max(0, years.indexOf(year));
  const hoveredValue = hovered ? row?.[hovered] : undefined;

  if (loadError) {
    return <Alert severity={"error"}>{loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper variant={"outlined"} sx={{ px: 2, py: 1.5 }}>
        <Stack
          direction={"row"}
          spacing={2}
          alignItems={"center"}
          flexWrap={"wrap"}
          useFlexGap
        >
          <IconButton
            color={"primary"}
            aria-label={playing ? "暫停播放" : "依年份播放"}
            onClick={togglePlay}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <Typography variant={"h5"} fontWeight={800} sx={{ minWidth: 64 }}>
            {year}
          </Typography>
          <Slider
            value={yearIndex}
            min={0}
            max={years.length - 1}
            step={1}
            marks={years.flatMap((value, index) =>
              Number(value) % 5 === 0 ? [{ value: index, label: value }] : [],
            )}
            valueLabelDisplay={"auto"}
            valueLabelFormat={(index) => years[index]}
            onChange={(_, index) => {
              setPlaying(false);
              onYearChange(years[index as number]);
            }}
            sx={{ mx: 1, flex: "1 1 200px" }}
          />
          <ToggleButtonGroup
            exclusive
            size={"small"}
            value={scaleMode}
            onChange={(_, value) => value && setScaleMode(value)}
            sx={{ flexShrink: 0 }}
          >
            <ToggleButton value={"year"}>當年度色階</ToggleButton>
            <ToggleButton value={"all"}>全期間色階</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper
          variant={"outlined"}
          sx={{ flex: "0 1 520px", p: 1, position: "relative" }}
        >
          {!counties ? (
            <Box sx={{ display: "grid", minHeight: 480, placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              component={"svg"}
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              role={"img"}
              aria-label={`${year} 年各縣市數值地圖`}
              sx={{
                display: "block",
                width: "100%",
                height: "auto",
                "& path": {
                  cursor: "pointer",
                  stroke: theme.palette.background.paper,
                  strokeWidth: 1.2,
                  transition: "fill 300ms ease",
                },
              }}
            >
              {paths.main.map(({ feature, path }) =>
                renderCounty(feature.properties.COUNTYNAME, path),
              )}
              {paths.insets.map(({ feature, path, box }) => (
                <g key={`inset-${feature.properties.COUNTYNAME}`}>
                  <rect
                    {...box}
                    rx={6}
                    fill={"none"}
                    stroke={theme.palette.divider}
                  />
                  <text
                    x={box.x + 8}
                    y={box.y + 15}
                    fontSize={11}
                    fill={theme.palette.text.secondary}
                  >
                    {feature.properties.COUNTYNAME}
                  </text>
                  {renderCounty(feature.properties.COUNTYNAME, path)}
                </g>
              ))}
            </Box>
          )}

          {/* 圖例：漸層條對應目前色階的最小～最大值 */}
          <Box sx={{ position: "absolute", left: 16, bottom: 16, width: 160 }}>
            <Box
              sx={{
                height: 10,
                borderRadius: 1,
                background: `linear-gradient(to right, ${fillOf(min)}, ${fillOf(max)})`,
              }}
            />
            <Stack direction={"row"} justifyContent={"space-between"}>
              <Typography variant={"caption"}>
                {min.toLocaleString("zh-TW")}
              </Typography>
              <Typography variant={"caption"}>
                {max.toLocaleString("zh-TW")}
              </Typography>
            </Stack>
          </Box>
        </Paper>

        <Paper variant={"outlined"} sx={{ flex: "1 1 320px", p: 2 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant={"body2"} color={"text.secondary"}>
                {hovered
                  ? `${TWAreaMappings[hovered]}・第 ${rankOf.get(hovered)} 名`
                  : "台灣"}
              </Typography>
              <Typography variant={"h5"} fontWeight={800}>
                {(hovered ? hoveredValue : row?.Taiwan) ?? "-"}
                {unit && (
                  <Typography
                    component={"span"}
                    color={"text.secondary"}
                    sx={{ ml: 0.75 }}
                  >
                    {unit}
                  </Typography>
                )}
              </Typography>
            </Box>
            <Stack spacing={0.25}>
              {ranking.map(({ area, value }, index) => (
                <Stack
                  key={area}
                  direction={"row"}
                  spacing={1}
                  alignItems={"center"}
                  onMouseEnter={() => setHovered(area)}
                  onMouseLeave={() => setHovered(undefined)}
                  onClick={() => navigate(areaProfileLink(area))}
                  sx={{
                    cursor: "pointer",
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: hovered === area ? "action.hover" : undefined,
                  }}
                >
                  <Typography
                    variant={"body2"}
                    color={"text.secondary"}
                    sx={{ width: 24, textAlign: "right" }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography variant={"body2"} sx={{ width: 56 }}>
                    {TWAreaMappings[area]}
                  </Typography>
                  <Box sx={{ flex: 1, height: 8 }}>
                    <Box
                      sx={{
                        height: "100%",
                        borderRadius: 1,
                        bgcolor: fillOf(value),
                        width:
                          value === null || max <= 0
                            ? 0
                            : `${Math.max(0, (value / max) * 100)}%`,
                      }}
                    />
                  </Box>
                  <Typography
                    variant={"body2"}
                    sx={{ minWidth: 88, textAlign: "right" }}
                  >
                    {row?.[area] ?? "-"}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
