import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import SearchIcon from "@mui/icons-material/Search";
import { useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { useTaipowerNeighbors } from "@/apis/opendata/taipower.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { TaipowerNeighborSearch } from "@/types/taipower.ts";

const basePath = "/data/taipower/neighbor";

function parseNumber(value: string | null) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function searchFromParams(params: URLSearchParams): TaipowerNeighborSearch {
  return {
    keyword: params.get("keyword")?.trim() || undefined,
    yearMonthFrom: params.get("yearMonthFrom")?.trim() || undefined,
    yearMonthTo: params.get("yearMonthTo")?.trim() || undefined,
    costFrom: parseNumber(params.get("costFrom")),
    costTo: parseNumber(params.get("costTo")),
    page: Math.max(1, Number(params.get("page")) || 1),
    per_page: 30,
  };
}

function toSearchParams(search: TaipowerNeighborSearch) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (
      value !== undefined &&
      value !== "" &&
      !(key === "page" && value === 1)
    ) {
      params.set(key, String(value));
    }
  }
  return params;
}

export default function TaipowerNeighborPage() {
  const { cityarea, unit } = useParams();
  const [params, setParams] = useSearchParams();
  const search = useMemo(() => searchFromParams(params), [params]);
  const [form, setForm] = useState(search);
  const scope = cityarea
    ? ({ type: "cityarea", value: cityarea } as const)
    : unit
      ? ({ type: "unit", value: unit } as const)
      : ({ type: "all" } as const);
  const query = useTaipowerNeighbors(search, scope);
  const pagination = query.data?.data;

  useTitle(
    cityarea
      ? `台電敦親睦鄰捐助－${cityarea}`
      : unit
        ? `台電敦親睦鄰捐助－${unit}`
        : "台電敦親睦鄰捐助",
  );

  useEffect(() => setForm(search), [search]);

  const submit = () => {
    setParams(toSearchParams({ ...form, page: 1 }));
  };

  const scopedTitle = cityarea
    ? `地區：${cityarea}`
    : unit
      ? `申請單位：${unit}`
      : "全部捐助資料";

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            background:
              "linear-gradient(135deg, #fff8e8 0%, #f5fbff 55%, #edf8f2 100%)",
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Chip label="Open Data / Taipower" color="warning" />
                <Typography variant="h3" component="h1" fontWeight={900} mt={1}>
                  台電敦親睦鄰捐助
                </Typography>
                <Typography color="text.secondary">{scopedTitle}</Typography>
              </Box>
              <Button
                component={RouterLink}
                to={`${basePath}/map`}
                startIcon={<MapIcon />}
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              >
                從台灣地圖查詢
              </Button>
            </Stack>

            {(cityarea || unit) && (
              <Button
                component={RouterLink}
                to={basePath}
                sx={{ alignSelf: "flex-start" }}
              >
                清除指定篩選
              </Button>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="關鍵字"
                value={form.keyword ?? ""}
                onChange={(event) =>
                  setForm({ ...form, keyword: event.target.value })
                }
                fullWidth
              />
              <TextField
                label="起始年月"
                type="month"
                value={form.yearMonthFrom ?? ""}
                onChange={(event) =>
                  setForm({ ...form, yearMonthFrom: event.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="結束年月"
                type="month"
                value={form.yearMonthTo ?? ""}
                onChange={(event) =>
                  setForm({ ...form, yearMonthTo: event.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="最低金額（千元）"
                type="number"
                value={form.costFrom ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    costFrom: parseNumber(event.target.value),
                  })
                }
              />
              <TextField
                label="最高金額（千元）"
                type="number"
                value={form.costTo ?? ""}
                onChange={(event) =>
                  setForm({ ...form, costTo: parseNumber(event.target.value) })
                }
              />
            </Stack>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={submit}
              sx={{ alignSelf: "flex-end" }}
            >
              查詢
            </Button>
          </Stack>
        </Paper>

        {query.isError && (
          <Alert severity="error">資料載入失敗，請確認查詢條件後再試。</Alert>
        )}

        {query.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table sx={{ minWidth: 1050 }}>
              <TableHead>
                <TableRow>
                  <TableCell>年月</TableCell>
                  <TableCell>補助縣市</TableCell>
                  <TableCell>申請單位</TableCell>
                  <TableCell>申請摘要</TableCell>
                  <TableCell>核准理由</TableCell>
                  <TableCell align="right">金額（千元）</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(pagination?.data ?? []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      {row.obj_year} 年 {row.obj_month} 月
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`${basePath}/cityarea/${encodeURIComponent(row.cityarea)}`}
                      >
                        {row.cityarea}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`${basePath}/unit/${encodeURIComponent(row.unit)}`}
                      >
                        {row.unit}
                      </Link>
                    </TableCell>
                    <TableCell>{row.summary}</TableCell>
                    <TableCell>{row.apply_reason}</TableCell>
                    <TableCell align="right">
                      {row.cash.toLocaleString("zh-TW", {
                        maximumFractionDigits: 3,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                {!pagination?.data.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      查無資料
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {(pagination?.last_page ?? 0) > 1 && (
          <Pagination
            count={pagination?.last_page ?? 1}
            page={search.page ?? 1}
            onChange={(_, page) =>
              setParams(toSearchParams({ ...search, page }))
            }
            shape="rounded"
            sx={{ alignSelf: "center" }}
          />
        )}
      </Stack>
    </Box>
  );
}
