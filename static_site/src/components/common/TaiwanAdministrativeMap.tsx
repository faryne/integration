import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import RemoveIcon from "@mui/icons-material/Remove";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { Objects, Topology } from "topojson-specification";

const mapWidth = 560;
const mapHeight = 720;

interface CountyProperties extends Record<string, unknown> {
  COUNTYNAME: string;
}

interface TownProperties extends CountyProperties {
  TOWNNAME: string;
}

interface TaiwanAdministrativeMapProps {
  onDistrictSelect: (cityArea: string) => void;
}

function normalizeAreaName(value: string) {
  return value.replaceAll("臺", "台");
}

async function loadTopology<T extends Objects>(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`載入地圖失敗：${response.status}`);
  }
  return (await response.json()) as Topology<T>;
}

function topologyFeatures<P extends GeoJsonProperties>(
  topology: Topology<Objects>,
): FeatureCollection<Geometry, P> {
  const object = topology.objects[Object.keys(topology.objects)[0]];
  return feature(topology, object) as unknown as FeatureCollection<Geometry, P>;
}

function mapPaths<P extends GeoJsonProperties>(
  features: FeatureCollection<Geometry, P>,
  width: number,
  height: number,
) {
  const projection = geoMercator().fitExtent(
    [
      [18, 18],
      [width - 18, height - 18],
    ],
    features,
  );
  const path = geoPath(projection);
  return features.features.map((item) => ({
    feature: item,
    path: path(item) ?? "",
  }));
}

export function TaiwanAdministrativeMap({
  onDistrictSelect,
}: TaiwanAdministrativeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef =
    useRef<ZoomBehavior<SVGSVGElement, unknown>>(undefined);
  const [counties, setCounties] =
    useState<FeatureCollection<Geometry, CountyProperties>>();
  const [towns, setTowns] =
    useState<FeatureCollection<Geometry, TownProperties>>();
  const [selectedCounty, setSelectedCounty] = useState("");
  const [hoveredArea, setHoveredArea] = useState("");
  const [loadError, setLoadError] = useState("");
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    Promise.all([
      loadTopology("/maps/taiwan-county.json"),
      loadTopology("/maps/taiwan-town.json"),
    ])
      .then(([countyTopology, townTopology]) => {
        setCounties(topologyFeatures<CountyProperties>(countyTopology));
        setTowns(topologyFeatures<TownProperties>(townTopology));
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "載入地圖失敗");
      });
  }, []);

  const visibleFeatures = useMemo(() => {
    if (!selectedCounty) {
      return counties;
    }
    if (!towns) {
      return undefined;
    }
    return {
      type: "FeatureCollection",
      features: towns.features.filter(
        (town) => town.properties.COUNTYNAME === selectedCounty,
      ),
    } satisfies FeatureCollection<Geometry, TownProperties>;
  }, [counties, selectedCounty, towns]);

  const paths = useMemo(
    () =>
      visibleFeatures ? mapPaths(visibleFeatures, mapWidth, mapHeight) : [],
    [visibleFeatures],
  );

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      return;
    }
    select(svgRef.current).call(
      zoomBehaviorRef.current.transform,
      zoomIdentity,
    );
  }, []);

  const scaleZoom = useCallback((factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) {
      return;
    }
    select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, factor);
  }, []);

  useEffect(() => {
    if (!counties || !towns || !svgRef.current) {
      return;
    }

    const svg = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [-mapWidth * 0.4, -mapHeight * 0.4],
        [mapWidth * 1.4, mapHeight * 1.4],
      ])
      .on("zoom", (event) => setTransform(event.transform));

    zoomBehaviorRef.current = behavior;
    svg.call(behavior);

    return () => {
      svg.on(".zoom", null);
      zoomBehaviorRef.current = undefined;
    };
  }, [counties, towns]);

  useEffect(() => {
    resetZoom();
  }, [resetZoom, selectedCounty]);

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }

  if (!counties || !towns) {
    return (
      <Box sx={{ display: "grid", minHeight: 480, placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
      <Paper
        variant="outlined"
        sx={{
          flex: "0 1 620px",
          overflow: "hidden",
          borderRadius: 4,
          bgcolor: "#eef8f4",
        }}
      >
        <Box sx={{ position: "relative" }}>
          <ButtonGroup
            aria-label="地圖縮放控制"
            orientation="vertical"
            size="small"
            sx={{
              position: "absolute",
              zIndex: 1,
              top: 16,
              right: 16,
              bgcolor: "white",
              boxShadow: 2,
            }}
          >
            <Button aria-label="放大地圖" onClick={() => scaleZoom(1.5)}>
              <AddIcon />
            </Button>
            <Button aria-label="縮小地圖" onClick={() => scaleZoom(1 / 1.5)}>
              <RemoveIcon />
            </Button>
            <Button aria-label="重設地圖" onClick={resetZoom}>
              <CenterFocusStrongIcon />
            </Button>
          </ButtonGroup>

          <Box
            ref={svgRef}
            component="svg"
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            role="img"
            aria-label={
              selectedCounty
                ? `${selectedCounty}行政區地圖`
                : "台灣縣市行政區地圖"
            }
            sx={{
              display: "block",
              width: "100%",
              height: { xs: 560, md: 760 },
              cursor: transform.k > 1 ? "grab" : "default",
              touchAction: "none",
              "&:active": {
                cursor: transform.k > 1 ? "grabbing" : "default",
              },
              "& path": {
                cursor: "pointer",
                stroke: "#fff",
                strokeWidth: selectedCounty ? 1.2 : 1.5,
                vectorEffect: "non-scaling-stroke",
                transition: "fill 160ms ease",
              },
            }}
          >
            <g transform={transform.toString()}>
              {paths.map(({ feature: area, path }) => {
                const countyName = area.properties.COUNTYNAME;
                const townName =
                  "TOWNNAME" in area.properties
                    ? area.properties.TOWNNAME
                    : undefined;
                const label = townName
                  ? `${countyName}${townName}`
                  : countyName;
                return (
                  <path
                    key={label}
                    d={path}
                    fill={hoveredArea === label ? "#1976d2" : "#71b89b"}
                    onClick={() => {
                      if (townName) {
                        onDistrictSelect(normalizeAreaName(label));
                      } else {
                        setSelectedCounty(countyName);
                        setHoveredArea("");
                      }
                    }}
                    onMouseEnter={() => setHoveredArea(label)}
                    onMouseLeave={() => setHoveredArea("")}
                  >
                    <title>{label}</title>
                  </path>
                );
              })}
            </g>
          </Box>
        </Box>
      </Paper>

      <Paper
        variant="outlined"
        sx={{ flex: "1 1 320px", p: 3, borderRadius: 4 }}
      >
        <Stack spacing={2}>
          {selectedCounty && (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setSelectedCounty("");
                setHoveredArea("");
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              回全台地圖
            </Button>
          )}
          <Box>
            <Typography variant="h4" fontWeight={900}>
              {selectedCounty || "選擇縣市"}
            </Typography>
            <Typography color="text.secondary">
              {selectedCounty
                ? "點擊地圖中的行政區，查看該地區的台電敦親睦鄰捐助資料。"
                : "點擊地圖中的縣市後，地圖會放大並顯示鄉鎮市區。"}
            </Typography>
          </Box>
          <Paper
            variant="outlined"
            sx={{ p: 2, minHeight: 84, bgcolor: "grey.50" }}
          >
            <Typography variant="body2" color="text.secondary">
              目前指向
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {hoveredArea || "將游標移到地圖上查看名稱"}
            </Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary">
            地圖倍率：{transform.k.toFixed(1)}x
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
