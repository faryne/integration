import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  useTaipowerNeighborManifest,
  useTaipowerPurposeStatistics,
} from "@/apis/opendata/taipower.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { TaipowerDataDisclaimer } from "@/components/taipower/TaipowerDataDisclaimer.tsx";
import { TaipowerNeighborBreadcrumb } from "@/components/taipower/TaipowerNeighborBreadcrumb.tsx";
import { TaipowerPurposeSummary } from "@/components/taipower/TaipowerPurposeSummary.tsx";
import { TaipowerPurposeTrend } from "@/components/taipower/TaipowerPurposeTrend.tsx";
import { summarizeTaipowerPurposes } from "@/helpers/taipowerPurpose.ts";
import { useTitle } from "@/helpers/title.tsx";
import type {
  TaipowerPurposeKey,
  TaipowerPurposeStatistic,
} from "@/types/taipower.ts";

const basePath = "/data/taipower/neighbor";
const emptyRows: TaipowerPurposeStatistic[] = [];

export default function TaipowerNeighborPurposePage() {
  const [params, setParams] = useSearchParams();
  const manifest = useTaipowerNeighborManifest();
  const query = useTaipowerPurposeStatistics(manifest.data?.files.purpose);
  const isError = manifest.isError || query.isError;
  const isLoading = manifest.isPending || query.isPending;
  const [errorOpen, setErrorOpen] = useState(false);
  useEffect(() => setErrorOpen(isError), [isError]);

  const rows = query.data?.data ?? emptyRows;
  const years = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => b - a),
    [rows],
  );
  const cities = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.cityarea))).sort((a, b) =>
        a.localeCompare(b, "zh-TW"),
      ),
    [rows],
  );
  const requestedYear = params.get("year");
  const year =
    requestedYear &&
    (requestedYear === "all" ||
      years.some((item) => String(item) === requestedYear))
      ? requestedYear
      : String(years[0] ?? "all");
  const requestedCity = params.get("cityarea");
  const city =
    requestedCity && cities.includes(requestedCity) ? requestedCity : "all";
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (year === "all" || row.year === Number(year)) &&
          (city === "all" || row.cityarea === city),
      ),
    [rows, year, city],
  );
  const summary = useMemo(
    () => summarizeTaipowerPurposes(visibleRows),
    [visibleRows],
  );
  const trendRows = useMemo(
    () => rows.filter((row) => city === "all" || row.cityarea === city),
    [rows, city],
  );

  useTitle("台電敦親睦鄰捐助－用途透視鏡");

  const updateFilter = (key: "year" | "cityarea", value: string) => {
    const next = new URLSearchParams(params);
    if (key === "cityarea" && value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };
  const detailPath = (purpose: TaipowerPurposeKey) => {
    const path =
      city === "all"
        ? basePath
        : `${basePath}/cityarea/${encodeURIComponent(city)}`;
    const search = new URLSearchParams({ purpose });
    if (year !== "all") {
      search.set("yearMonthFrom", `${year}-01`);
      search.set("yearMonthTo", `${year}-12`);
    }
    return `${path}?${search}`;
  };

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <TaipowerNeighborBreadcrumb current="用途透視鏡" />
        <Paper
          variant="outlined"
          sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}
        >
          <Chip label="Taipower / Data Explorer" color="success" />
          <Typography variant="h3" component="h1" fontWeight={900} mt={1}>
            台電敦親睦鄰捐助
            <br />
            用途透視鏡
          </Typography>
          <Typography color="text.secondary" mt={1}>
            看看核准案件的摘要提到了哪些用途，以及各地區、各年度的分布。類別由文字規則整理，仍可回到逐筆資料核對。
          </Typography>
          {manifest.data && (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              mt={2}
            >
              <Chip
                size="small"
                label={`來源最新月份：${manifest.data.source_latest_month || "未提供"}`}
              />
              <Chip
                size="small"
                label={`統計產生：${new Date(manifest.data.generated_at).toLocaleString("zh-TW")}`}
              />
              {year === String(new Date().getFullYear()) && (
                <Chip size="small" label={`${year} 年資料尚未完整`} />
              )}
            </Stack>
          )}
        </Paper>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            label="年度"
            value={year}
            onChange={(event) => updateFilter("year", event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">全部年度</MenuItem>
            {years.map((item) => (
              <MenuItem key={item} value={String(item)}>
                {item} 年{item === new Date().getFullYear() ? "（未完整）" : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="行政區"
            value={city}
            onChange={(event) => updateFilter("cityarea", event.target.value)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="all">全台灣</MenuItem>
            {cities.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {isError ? (
          <Alert severity="error">用途統計載入失敗，請稍後再試。</Alert>
        ) : isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TaipowerPurposeSummary {...summary} detailPath={detailPath} />
            <TaipowerPurposeTrend
              rows={trendRows}
              selectedYear={year}
              onSelectYear={(value) => updateFilter("year", value)}
            />
          </>
        )}
      </Stack>
      <TaipowerDataDisclaimer />
      <CustomSnackbar
        open={errorOpen}
        severity="error"
        message="用途統計載入失敗。"
        onClose={() => setErrorOpen(false)}
      />
    </Box>
  );
}
