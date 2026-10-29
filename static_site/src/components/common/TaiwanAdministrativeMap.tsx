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
import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import {
  countyGeographicOrder,
  countyTopologyPath,
  type CountyProperties,
  loadTopology,
  mapPaths,
  normalizeAreaName,
  topologyFeatures,
  type TownProperties,
  townTopologyPath,
} from "@/components/common/taiwanMapGeo.ts";

const mapWidth = 560;
const mapHeight = 720;

interface TaiwanAdministrativeMapProps {
  onDistrictSelect: (cityArea: string) => void;
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
      loadTopology(countyTopologyPath),
      loadTopology(townTopologyPath),
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

  const countyNames = useMemo(
    () =>
      counties
        ? counties.features
            .map((county) => county.properties.COUNTYNAME)
            .sort((a, b) => {
              const aIndex = countyGeographicOrder.indexOf(a);
              const bIndex = countyGeographicOrder.indexOf(b);
              if (aIndex === -1 || bIndex === -1) {
                return a.localeCompare(b, "zh-TW");
              }
              return aIndex - bIndex;
            })
        : [],
    [counties],
  );

  const districtNames = useMemo(
    () =>
      selectedCounty && towns
        ? towns.features
            .filter((town) => town.properties.COUNTYNAME === selectedCounty)
            .map((town) => town.properties.TOWNNAME)
            .sort((a, b) => a.localeCompare(b, "zh-TW"))
        : [],
    [selectedCounty, towns],
  );

  const selectCounty = useCallback((countyName: string) => {
    setSelectedCounty(countyName);
    setHoveredArea("");
  }, []);

  const selectDistrict = useCallback(
    (countyName: string, townName: string) => {
      onDistrictSelect(normalizeAreaName(`${countyName}${townName}`));
    },
    [onDistrictSelect],
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
                    ? String(area.properties.TOWNNAME)
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
                        selectDistrict(countyName, townName);
                      } else {
                        selectCounty(countyName);
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
                ? "點擊地圖或下方清單中的行政區，查看該地區的台電敦親睦鄰捐助資料。"
                : "點擊地圖或下方清單中的縣市，顯示該縣市的鄉鎮市區。"}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1,
              maxHeight: 420,
              overflowY: "auto",
              pr: 0.5,
            }}
          >
            {(selectedCounty ? districtNames : countyNames).map((name) => {
              const label = selectedCounty ? `${selectedCounty}${name}` : name;
              return (
                <Button
                  key={name}
                  variant={hoveredArea === label ? "contained" : "outlined"}
                  onClick={() =>
                    selectedCounty
                      ? selectDistrict(selectedCounty, name)
                      : selectCounty(name)
                  }
                  onMouseEnter={() => setHoveredArea(label)}
                  onMouseLeave={() => setHoveredArea("")}
                  sx={{
                    justifyContent: "flex-start",
                    minWidth: 0,
                    px: 1.25,
                  }}
                >
                  {name}
                </Button>
              );
            })}
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
