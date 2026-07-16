import { useFireDepartmentRealtimeEvents } from "@/apis/opendata/firedepartment.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PublicIcon from "@mui/icons-material/Public";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import { TWAreaMappings, type TWArea } from "@/types/twstats.ts";
import type { Event } from "@/types/firedepartment.ts";
import dayjs from "dayjs";
import { useTitle } from "@/helpers/title.tsx";

type RegionFilter = "all" | TWArea;

interface FireDepartmentAreaGroup {
  label: string;
  areas: TWArea[];
}

const fireDepartmentAreaGroups: FireDepartmentAreaGroup[] = [
  { label: "北北基", areas: ["Taipei", "NewTaipei", "Keelung"] },
  { label: "桃竹苗", areas: ["Taoyuan", "HsinchuCity", "Miaoli"] },
  { label: "中彰投", areas: ["Taichung"] },
  { label: "雲嘉南", areas: ["Yunlin", "Tainan"] },
  { label: "高屏", areas: ["Kaohsiung"] },
  { label: "宜花東", areas: ["Ilan"] },
];

const supportedFireDepartmentAreas: TWArea[] = fireDepartmentAreaGroups.flatMap(
  (group) => group.areas,
);

interface RegionGroup {
  key: TWArea;
  name: string;
  events: Event[];
}

interface DisplayEvent extends Event {
  regionKey: TWArea;
  regionName: string;
}

const formatTimestamp = (timestamp: number) =>
  dayjs(timestamp * 1000).format("YYYY-MM-DD HH:mm:ss");

const getRegionName = (key: TWArea) => TWAreaMappings[key] ?? key;

const getEventKey = (event: DisplayEvent, index: number) =>
  [
    event.regionKey,
    event.timestamp,
    event.event_type,
    event.sub_type,
    event.endpoint_info,
    index,
  ].join("-");

const isSupportedArea = (value?: string): value is TWArea =>
  !!value && supportedFireDepartmentAreas.includes(value as TWArea);

export function FireDepartmentRealtime() {
  const navigate = useNavigate();
  const { city } = useParams<{ city?: string }>();
  const regionFilter: RegionFilter = isSupportedArea(city) ? city : "all";
  const [q, setQ] = useState<string>(new Date().toString());
  const [keyword, setKeyword] = useState("");
  const realtimeEvents = useFireDepartmentRealtimeEvents(q, regionFilter);

  useTitle("即時消防出勤記錄");

  useEffect(() => {
    if (city && !isSupportedArea(city)) {
      navigate("/data/fire/realtime", { replace: true });
    }
  }, [city, navigate]);

  const handleRegionSelect = useCallback(
    (area: RegionFilter) => {
      navigate(
        area === "all" ? "/data/fire/realtime" : `/data/fire/realtime/${area}`,
      );
    },
    [navigate],
  );

  useEffect(() => {
    const timer = setInterval(() => setQ(new Date().toString()), 300000);

    return () => clearInterval(timer);
  }, []);

  const regions = useMemo<RegionGroup[]>(() => {
    const data = (realtimeEvents.data?.data ?? {}) as Partial<
      Record<TWArea, Event[]>
    >;

    return Object.entries(data)
      .map(([key, events]) => ({
        key: key as TWArea,
        name: getRegionName(key as TWArea),
        events: [...(events ?? [])].sort((a, b) => b.timestamp - a.timestamp),
      }))
      .filter((region) => region.events.length > 0)
      .sort((a, b) => b.events.length - a.events.length);
  }, [realtimeEvents.data?.data]);
  const eventCountByRegion = useMemo(
    () =>
      new Map<TWArea, number>(
        regions.map((region) => [region.key, region.events.length]),
      ),
    [regions],
  );

  const allEvents = useMemo<DisplayEvent[]>(
    () =>
      regions
        .flatMap((region) =>
          region.events.map((event) => ({
            ...event,
            regionKey: region.key,
            regionName: region.name,
          })),
        )
        .sort((a, b) => b.timestamp - a.timestamp),
    [regions],
  );

  const filteredEvents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return allEvents.filter((event) => {
      const searchableText = [
        event.regionName,
        event.event_type,
        event.sub_type,
        event.title,
        event.endpoint_info,
        ...(event.cars ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedKeyword);
    });
  }, [allEvents, keyword]);

  const latestUpdatedAt = allEvents[0]?.timestamp
    ? formatTimestamp(allEvents[0].timestamp)
    : "尚無資料";
  const totalCars = allEvents.reduce(
    (total, event) => total + (event.cars?.length ?? 0),
    0,
  );

  return (
    <Box
      sx={{
        mx: "auto",
        width: "100%",
        maxWidth: 1180,
        px: { xs: 2, md: 0 },
        py: { xs: 1, md: 2 },
      }}
    >
      <Stack spacing={3.5}>
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 4,
            background:
              "radial-gradient(circle at top left, rgba(255, 122, 89, 0.22), transparent 34%), linear-gradient(135deg, #fff8f2 0%, #f8fbff 58%, #eef6f4 100%)",
          }}
        >
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack spacing={1}>
                  <Chip
                    icon={<LocalFireDepartmentIcon />}
                    label="Open Data / Fire Department"
                    color="error"
                    variant="outlined"
                    sx={{ alignSelf: "flex-start", bgcolor: "white" }}
                  />
                  <Typography variant="h3" component="h1" fontWeight={900}>
                    即時消防出勤記錄
                  </Typography>
                  <Typography color="text.secondary">
                    以縣市為單位整合救災救護事件，適合快速掃描最新案件、地點與派車狀態。
                  </Typography>
                </Stack>

                <Button
                  variant="contained"
                  color="error"
                  startIcon={<RefreshIcon />}
                  onClick={() => setQ(new Date().toString())}
                  disabled={realtimeEvents.isFetching}
                >
                  重新整理
                </Button>
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
              >
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 180, p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    目前事件
                  </Typography>
                  <Typography variant="h4" fontWeight={900}>
                    {allEvents.length.toLocaleString("zh-TW")}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 180, p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    涵蓋縣市
                  </Typography>
                  <Typography variant="h4" fontWeight={900}>
                    {regions.length.toLocaleString("zh-TW")}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ flex: 1, minWidth: 180, p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    派車紀錄
                  </Typography>
                  <Typography variant="h4" fontWeight={900}>
                    {totalCars.toLocaleString("zh-TW")}
                  </Typography>
                </Paper>
                <Paper
                  variant="outlined"
                  sx={{ flex: 1.4, minWidth: 220, p: 2 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    最新時間
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {latestUpdatedAt}
                  </Typography>
                </Paper>
              </Stack>
            </Stack>
          </Box>
        </Paper>

        {realtimeEvents.isError && (
          <Alert severity="error">即時消防資料載入失敗，請稍後再試。</Alert>
        )}

        <Paper
          variant="outlined"
          sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
            >
              <TextField
                type="search"
                label="搜尋事件"
                placeholder="輸入地點、事件類型、車號或縣市"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                sx={{ minWidth: { md: 360 } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Stack direction="row" spacing={1} alignItems="center">
                {realtimeEvents.isFetching && <CircularProgress size={18} />}
                <Typography variant="body2" color="text.secondary">
                  每 5 分鐘自動更新
                </Typography>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              spacing={1.5}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
            >
              <Chip
                icon={<PublicIcon />}
                label={`全部縣市 ${allEvents.length}`}
                color={regionFilter === "all" ? "error" : "default"}
                variant={regionFilter === "all" ? "filled" : "outlined"}
                onClick={() => handleRegionSelect("all")}
              />
              {fireDepartmentAreaGroups.map((group) => (
                <Stack
                  key={group.label}
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{
                    pl: 1.5,
                    borderLeft: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.label}
                  </Typography>
                  {group.areas.map((area) => {
                    const eventCount = eventCountByRegion.get(area);

                    return (
                      <Chip
                        key={area}
                        label={`${getRegionName(area)}${eventCount === undefined ? "" : ` ${eventCount}`}`}
                        color={regionFilter === area ? "error" : "default"}
                        variant={regionFilter === area ? "filled" : "outlined"}
                        onClick={() => handleRegionSelect(area)}
                      />
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>

        {realtimeEvents.isLoading ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress color="error" />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              正在載入即時事件
            </Typography>
          </Paper>
        ) : filteredEvents.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" fontWeight={800}>
              找不到符合條件的事件
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              請調整縣市或搜尋關鍵字。
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              顯示 {filteredEvents.length.toLocaleString("zh-TW")} 筆事件
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(auto-fit, minmax(320px, 1fr))",
                  lg: "repeat(auto-fit, minmax(340px, 1fr))",
                },
                gap: 1.5,
                alignItems: "start",
              }}
            >
              {filteredEvents.map((event, index) => (
                <Card
                  key={getEventKey(event, index)}
                  variant="outlined"
                  sx={{
                    height: "100%",
                    borderRadius: 3,
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 14px 32px rgba(15, 23, 42, 0.10)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                    <Stack spacing={1.5}>
                      <Stack spacing={1}>
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                          alignItems="center"
                        >
                          <Chip
                            size="small"
                            color="error"
                            label={event.regionName}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={event.event_type || "未分類"}
                          />
                          {event.sub_type && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={event.sub_type}
                            />
                          )}
                        </Stack>

                        <Typography variant="h6" fontWeight={900}>
                          {event.title ||
                            `${event.event_type} ${event.sub_type}`}
                        </Typography>

                        <Stack direction="row" spacing={1} alignItems="center">
                          <AccessTimeIcon color="action" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            {formatTimestamp(event.timestamp)}
                          </Typography>
                        </Stack>
                      </Stack>

                      <Divider />

                      <Stack spacing={1.25}>
                        <Stack
                          direction="row"
                          spacing={1.2}
                          alignItems="flex-start"
                        >
                          <LocationOnIcon color="error" fontSize="small" />
                          <Box>
                            <Typography fontWeight={700}>地點</Typography>
                            <Typography color="text.secondary">
                              {event.endpoint_info || "未提供地點"}
                            </Typography>
                            {event.lat && event.lng && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {event.lat}, {event.lng}
                              </Typography>
                            )}
                          </Box>
                        </Stack>

                        <Stack
                          direction="row"
                          spacing={1.2}
                          alignItems="flex-start"
                        >
                          <DirectionsCarIcon color="action" fontSize="small" />
                          <Box>
                            <Typography fontWeight={700}>派車資訊</Typography>
                            {event.cars?.length ? (
                              <Stack
                                direction="row"
                                spacing={0.75}
                                flexWrap="wrap"
                                useFlexGap
                                sx={{ mt: 0.75 }}
                              >
                                {event.cars.map((car) => (
                                  <Chip key={car} size="small" label={car} />
                                ))}
                              </Stack>
                            ) : (
                              <Typography color="text.secondary">-</Typography>
                            )}
                          </Box>
                        </Stack>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
