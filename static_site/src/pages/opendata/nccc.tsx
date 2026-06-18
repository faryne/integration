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
import TableRowsIcon from "@mui/icons-material/TableRows";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useNCCCIndexes, useNCCCRecords } from "@/apis/opendata/nccc.ts";
import { EsCursorPagination } from "@/components/common/EsCursorPagination.tsx";
import { useTitle } from "@/helpers/title.tsx";
import type { NCCCRecord, NCCCRecordSearch } from "@/types/nccc.ts";

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
  };
}

function toSearchParams(token: string | undefined, search: NCCCRecordSearch) {
  const params = new URLSearchParams();
  if (token) params.set("index", token);
  if (search.cursor) params.set("cursor", search.cursor);
  if (search.yearMonths?.length) {
    params.set("yearMonths", search.yearMonths.join(","));
  }
  if (search.region) params.set("region", search.region);
  if (search.category) params.set("category", search.category);
  return params;
}

function displayValue(value: NCCCRecord[string]) {
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
  const [params, setParams] = useSearchParams();
  const selectedToken = params.get("index")?.trim() || undefined;
  const search = useMemo(() => searchFromParams(params), [params]);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const indexesQuery = useNCCCIndexes();
  const recordsQuery = useNCCCRecords(selectedToken, search);
  const pagination = recordsQuery.data?.data;
  const rows = pagination?.data ?? [];
  const columns = useMemo(() => collectColumns(rows), [rows]);
  const visibleColumns = columns.filter(
    (column) => requiredColumn(column) || !hiddenColumns.includes(column),
  );
  const selectedIndexText =
    indexesQuery.data?.data.find((item) => item.token === selectedToken)
      ?.text ?? "";

  useTitle("NCCC 信用卡消費資料");

  const selectIndex = (token: string) => {
    setCursorHistory([]);
    setHiddenColumns([]);
    setParams(toSearchParams(token, { page: 1 }));
  };

  const updateSearch = (nextSearch: NCCCRecordSearch) => {
    setCursorHistory([]);
    setParams(
      toSearchParams(selectedToken, { ...nextSearch, cursor: undefined }),
    );
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
                <FormControl sx={{ minWidth: 180 }}>
                  <InputLabel id="nccc-region-select-label">地區</InputLabel>
                  <Select
                    labelId="nccc-region-select-label"
                    label="地區"
                    value={search.region ?? ""}
                    onChange={(event) =>
                      updateSearch({
                        ...search,
                        region: event.target.value || undefined,
                      })
                    }
                  >
                    <MenuItem value="">全部</MenuItem>
                    {(pagination?.facets.regions ?? []).map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.value}（{item.count.toLocaleString("zh-TW")}）
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 180 }}>
                  <InputLabel id="nccc-category-select-label">類別</InputLabel>
                  <Select
                    labelId="nccc-category-select-label"
                    label="類別"
                    value={search.category ?? ""}
                    onChange={(event) =>
                      updateSearch({
                        ...search,
                        category: event.target.value || undefined,
                      })
                    }
                  >
                    <MenuItem value="">全部</MenuItem>
                    {(pagination?.facets.categories ?? []).map((item) => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.value}（{item.count.toLocaleString("zh-TW")}）
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                            {displayValue(row[column])}
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
                  setParams(
                    toSearchParams(selectedToken, {
                      page: 1,
                      cursor: previousCursor,
                    }),
                  );
                }}
                onNext={() => {
                  if (!pagination.next_cursor) return;
                  setCursorHistory([...cursorHistory, search.cursor ?? ""]);
                  setParams(
                    toSearchParams(selectedToken, {
                      page: 1,
                      cursor: pagination.next_cursor,
                    }),
                  );
                }}
              />
            </Stack>
          )
        )}
      </Stack>
    </Box>
  );
}
