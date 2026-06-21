import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
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
import DatasetIcon from "@mui/icons-material/Dataset";
import AddIcon from "@mui/icons-material/Add";
import ShareIcon from "@mui/icons-material/Share";
import TableRowsIcon from "@mui/icons-material/TableRows";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useNCCCIndexes, useNCCCRecords } from "@/apis/opendata/nccc.ts";
import { EsCursorPagination } from "@/components/common/EsCursorPagination.tsx";
import { buildSnsShareUrl, shareUrl } from "@/helpers/share.ts";
import { useTitle } from "@/helpers/title.tsx";
import type {
  NCCCFieldFacet,
  NCCCRecord,
  NCCCRecordSearch,
} from "@/types/nccc.ts";

const taiwanRegionOrder = [
  "台北市",
  "新北市",
  "桃園市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "台中市",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義縣",
  "嘉義市",
  "台南市",
  "高雄市",
  "屏東縣",
  "基隆市",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

const taiwanRegionRank = new Map(
  taiwanRegionOrder.map((region, index) => [region, index]),
);

function encodeUrlPayload(value: unknown) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeUrlPayload(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeFilters(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string | string[]>;
    const filters: Record<string, string[]> = {};
    Object.entries(parsed).forEach(([rawField, rawValue]) => {
      const field = rawField.trim();
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const normalized = Array.from(
        new Set(values.map((value) => String(value).trim()).filter(Boolean)),
      );
      if (field && normalized.length) {
        filters[field] = normalized;
      }
    });
    return Object.keys(filters).length ? filters : undefined;
  } catch {
    return undefined;
  }
}

function filtersFromParams(params: URLSearchParams) {
  const encoded = params.get("f")?.trim();
  if (encoded) {
    try {
      const filters = normalizeFilters(decodeUrlPayload(encoded));
      if (filters) return filters;
    } catch {
      return undefined;
    }
  }
  return normalizeFilters(params.get("filters")?.trim());
}

function searchFromParams(params: URLSearchParams): NCCCRecordSearch {
  return {
    page: 1,
    per_page: 30,
    cursor: params.get("cursor")?.trim() || undefined,
    yearMonths:
      params
        .get("yearMonths")
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) || undefined,
    region: params.get("region")?.trim() || undefined,
    category: params.get("category")?.trim() || undefined,
    filters: filtersFromParams(params),
  };
}

function toSearchParams(search: NCCCRecordSearch) {
  const params = new URLSearchParams();
  if (search.cursor) params.set("cursor", search.cursor);
  if (search.yearMonths?.length) {
    params.set("yearMonths", search.yearMonths.join(","));
  }
  if (search.region) params.set("region", search.region);
  if (search.category) params.set("category", search.category);
  if (search.filters && Object.keys(search.filters).length) {
    params.set("f", encodeUrlPayload(search.filters));
  }
  return params;
}

function toNCCCPath(token: string | undefined, search: NCCCRecordSearch) {
  const query = toSearchParams(search).toString();
  const path = token
    ? `/data/nccc/${encodeURIComponent(token)}`
    : "/data/nccc";
  return query ? `${path}?${query}` : path;
}

function displayValue(column: string, value: NCCCRecord[string]) {
  if (column === "性別") {
    if (value === 1 || value === "1") return "男性";
    if (value === 2 || value === "2") return "女性";
  }

  if (typeof value === "number") {
    return value.toLocaleString("zh-TW", { maximumFractionDigits: 6 });
  }
  if (typeof value === "string") {
    const normalized = value.trim().replaceAll(",", "");
    if (normalized !== "" && Number.isFinite(Number(normalized))) {
      return Number(normalized).toLocaleString("zh-TW", {
        maximumFractionDigits: 6,
      });
    }
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function collectColumns(rows: NCCCRecord[]) {
  const preferred = ["年月", "年度", "地區", "類別"];
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== "id_key") keys.add(key);
    });
  });
  return [
    ...preferred.filter((key) => keys.delete(key)),
    ...Array.from(keys).sort((a, b) => a.localeCompare(b, "zh-Hant")),
  ];
}

function sortFacetOptions(field: string, options: string[]) {
  if (field !== "地區") return options;
  return [...options].sort((a, b) => {
    const rankA = taiwanRegionRank.get(a);
    const rankB = taiwanRegionRank.get(b);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return a.localeCompare(b, "zh-Hant");
  });
}

function filterFacetsFromIndexFilters(
  filters: Record<string, string[]> | undefined,
) {
  return Object.entries(filters ?? {})
    .map(([field, options]) => ({
      field,
      options,
    }))
    .filter((facet) => facet.options.length);
}

function mergeSelectedFacetOptions(
  facets: NCCCFieldFacet[],
  filters: Record<string, string[]> | undefined,
) {
  const merged = new Map<string, NCCCFieldFacet>();
  facets.forEach((facet) => {
    merged.set(facet.field, {
      ...facet,
      options: [...facet.options],
    });
  });
  Object.entries(filters ?? {}).forEach(([field, values]) => {
    const facet = merged.get(field) ?? { field, options: [] };
    const existing = new Set(facet.options);
    values.forEach((value) => {
      if (existing.has(value)) return;
      facet.options.push(value);
      existing.add(value);
    });
    merged.set(field, facet);
  });
  return Array.from(merged.values());
}

function gregorianMonthToNCCC(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return "";
  return `${parsedYear - 1911}年${String(parsedMonth).padStart(2, "0")}月`;
}

function requiredColumn(column: string) {
  return column === "年月" || column === "地區";
}

export default function NCCCPage() {
  const navigate = useNavigate();
  const routeParams = useParams();
  const [params] = useSearchParams();
  const selectedToken =
    routeParams.token?.trim() || params.get("index")?.trim() || undefined;
  const search = useMemo(() => searchFromParams(params), [params]);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [shareNotice, setShareNotice] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const indexesQuery = useNCCCIndexes();
  const recordsQuery = useNCCCRecords(selectedToken, search);
  const pagination = recordsQuery.data?.data;
  const rows = pagination?.data ?? [];
  const selectedIndex =
    indexesQuery.data?.data.find((item) => item.token === selectedToken) ??
    pagination?.index;
  const filterFacets = useMemo(
    () =>
      mergeSelectedFacetOptions(
        filterFacetsFromIndexFilters(selectedIndex?.filters),
        search.filters,
      ),
    [selectedIndex?.filters, search.filters],
  );
  const columns = useMemo(() => collectColumns(rows), [rows]);
  const visibleColumns = columns.filter(
    (column) => requiredColumn(column) || !hiddenColumns.includes(column),
  );
  const selectedIndexText = selectedIndex?.text ?? "";
  const seoTitle = selectedIndexText
    ? `NCCC 信用卡消費資料 - ${selectedIndexText}`
    : "NCCC 信用卡消費資料";
  const seoDescription = selectedIndexText
    ? `查詢 NCCC「${selectedIndexText}」信用卡公開資料，依年月、地區與欄位條件篩選消費統計。`
    : "查詢 NCCC 信用卡公開資料，依資料集、年月、地區與欄位條件篩選消費統計。";
  const shareLink =
    typeof window === "undefined"
      ? ""
      : buildSnsShareUrl(toNCCCPath(selectedToken, search));

  useTitle(seoTitle, {
    description: seoDescription,
    path: toNCCCPath(selectedToken, search),
    robots: search.cursor ? "noindex, follow" : "index, follow",
  });

  const selectIndex = (token: string) => {
    setCursorHistory([]);
    setHiddenColumns([]);
    navigate(toNCCCPath(token, { page: 1 }));
  };

  const updateSearch = (nextSearch: NCCCRecordSearch) => {
    setCursorHistory([]);
    navigate(toNCCCPath(selectedToken, { ...nextSearch, cursor: undefined }));
  };

  const addSelectedMonth = () => {
    const month = gregorianMonthToNCCC(selectedMonth);
    if (!month) return;
    const yearMonths = Array.from(
      new Set([...(search.yearMonths ?? []), month]),
    ).sort();
    updateSearch({ ...search, yearMonths });
    setSelectedMonth("");
  };

  const removeSelectedMonth = (month: string) => {
    const yearMonths = (search.yearMonths ?? []).filter(
      (value) => value !== month,
    );
    updateSearch({
      ...search,
      yearMonths: yearMonths.length ? yearMonths : undefined,
    });
  };

  const toggleColumn = (column: string) => {
    if (requiredColumn(column)) return;
    setHiddenColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column],
    );
  };

  const updateFieldFilter = (field: string, values: string[]) => {
    const filters = { ...(search.filters ?? {}) };
    const nextValues = Array.from(
      new Set(values.map((value) => value.trim()).filter(Boolean)),
    );
    if (nextValues.length) {
      filters[field] = nextValues;
    } else {
      delete filters[field];
    }
    updateSearch({
      ...search,
      filters: Object.keys(filters).length ? filters : undefined,
    });
  };

  const handleShare = async () => {
    const result = await shareUrl({
      title: seoTitle,
      url: shareLink,
    });
    if (result === "copied") setShareNotice("分享連結已複製");
    if (result === "failed") setShareNotice("無法分享連結");
  };

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 3,
            background:
              "linear-gradient(135deg, #f7fbff 0%, #fffaf2 52%, #f1f8f5 100%)",
          }}
        >
          <Stack spacing={2}>
            <Chip
              icon={<DatasetIcon />}
              label="Open Data / NCCC"
              color="primary"
              sx={{ alignSelf: "flex-start" }}
            />
            <Box>
              <Typography variant="h3" component="h1" fontWeight={900}>
                NCCC 信用卡消費資料
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                選擇資料集後瀏覽已匯入 Elasticsearch 的公開資料。
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TableRowsIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>
                可瀏覽資料集
              </Typography>
            </Stack>
            {indexesQuery.isError && (
              <Alert severity="error">資料集載入失敗，請稍後再試。</Alert>
            )}
            {indexesQuery.isLoading ? (
              <Box sx={{ display: "grid", placeItems: "center", py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="nccc-index-select-label">資料集</InputLabel>
                <Select
                  labelId="nccc-index-select-label"
                  label="資料集"
                  value={selectedToken ?? ""}
                  onChange={(event) => selectIndex(event.target.value)}
                >
                  {(indexesQuery.data?.data ?? []).map((item) => (
                    <MenuItem key={item.token} value={item.token}>
                      {item.text}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </Paper>

        {selectedToken && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={800}>
                篩選條件
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="指定年月"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ minWidth: 180 }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addSelectedMonth}
                    disabled={!selectedMonth}
                  >
                    加入
                  </Button>
                </Stack>
                {filterFacets.map((facet) => (
                  <FormControl key={facet.field} sx={{ minWidth: 180 }}>
                    <InputLabel id={`nccc-${facet.field}-select-label`}>
                      {facet.field}
                    </InputLabel>
                    <Select
                      labelId={`nccc-${facet.field}-select-label`}
                      label={facet.field}
                      multiple
                      value={search.filters?.[facet.field] ?? []}
                      onChange={(event) =>
                        updateFieldFilter(
                          facet.field,
                          typeof event.target.value === "string"
                            ? event.target.value.split(",")
                            : event.target.value,
                        )
                      }
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              size="small"
                              label={displayValue(facet.field, value)}
                            />
                          ))}
                        </Box>
                      )}
                    >
                      {sortFacetOptions(facet.field, facet.options).map(
                        (value) => (
                          <MenuItem key={value} value={value}>
                            <Checkbox
                              checked={(
                                search.filters?.[facet.field] ?? []
                              ).includes(value)}
                            />
                            {displayValue(facet.field, value)}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                ))}
              </Stack>
              {!!search.yearMonths?.length && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {search.yearMonths.map((month) => (
                    <Chip
                      key={month}
                      label={month}
                      onDelete={() => removeSelectedMonth(month)}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        )}

        {!selectedToken && (
          <Alert severity="info">請先選擇一個 NCCC 資料集。</Alert>
        )}

        {selectedToken && recordsQuery.isError && (
          <Alert severity="error">資料載入失敗，請重新選擇資料集。</Alert>
        )}

        {selectedToken && recordsQuery.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          selectedToken &&
          pagination && (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "flex-start" }}
                spacing={1}
              >
                <Box>
                  <Typography variant="h5" component="h2" fontWeight={850}>
                    {pagination.index.text || selectedIndexText}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    共 {pagination.total.toLocaleString("zh-TW")} 筆資料
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={handleShare}
                >
                  分享
                </Button>
              </Stack>

              {!!columns.length && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={800} mb={1}>
                    顯示欄位
                  </Typography>
                  <FormGroup row>
                    {columns.map((column) => (
                      <FormControlLabel
                        key={column}
                        control={
                          <Checkbox
                            size="small"
                            checked={!hiddenColumns.includes(column)}
                            disabled={requiredColumn(column)}
                            onChange={() => toggleColumn(column)}
                          />
                        }
                        label={column}
                      />
                    ))}
                  </FormGroup>
                </Paper>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ minWidth: 1100 }} size="small">
                  <TableHead>
                    <TableRow>
                      {visibleColumns.map((column) => (
                        <TableCell key={column}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, rowIndex) => (
                      <TableRow key={`${pagination.from}-${rowIndex}`} hover>
                        {visibleColumns.map((column) => (
                          <TableCell
                            key={column}
                            align={
                              typeof row[column] === "number" ? "right" : "left"
                            }
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {displayValue(column, row[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell
                          colSpan={Math.max(visibleColumns.length, 1)}
                          align="center"
                        >
                          查無資料
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <EsCursorPagination
                perPage={pagination.per_page}
                from={pagination.from}
                to={pagination.to}
                total={pagination.total}
                hasPrevious={cursorHistory.length > 0 || !!search.cursor}
                hasNext={!!pagination.has_next}
                onPrevious={() => {
                  const nextHistory = [...cursorHistory];
                  const previousCursor = nextHistory.pop();
                  setCursorHistory(nextHistory);
                  navigate(
                    toNCCCPath(selectedToken, {
                      ...search,
                      cursor: previousCursor,
                    }),
                  );
                }}
                onNext={() => {
                  if (!pagination.next_cursor) return;
                  setCursorHistory([...cursorHistory, search.cursor ?? ""]);
                  navigate(
                    toNCCCPath(selectedToken, {
                      ...search,
                      cursor: pagination.next_cursor,
                    }),
                  );
                }}
              />
            </Stack>
          )
        )}
      </Stack>
      <Snackbar
        open={Boolean(shareNotice)}
        autoHideDuration={2500}
        onClose={() => setShareNotice("")}
        message={shareNotice}
      />
    </Box>
  );
}
