import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import InsertChartOutlinedIcon from "@mui/icons-material/InsertChartOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import { Link } from "react-router-dom";
import { useGetTwStatsIndex } from "@/apis/opendata/twstats.ts";
import { useMemo, useState } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { useUpdateSearchParams } from "@/helpers/useUpdateSearchParams.ts";
import {
  categoryOf,
  isTwStatsCategory,
} from "@/components/twstats/twStatsCategories.ts";
import { TwStatsCategoryChips } from "@/components/twstats/TwStatsCategoryChips.tsx";
import { TwStatsEntrances } from "@/components/twstats/TwStatsEntrances.tsx";

const twStatsDocsBaseUri =
  "https://raw.githubusercontent.com/faryne/tw-stats/master/docs";
const twStatsGithubDocsBaseUri =
  "https://github.com/faryne/tw-stats/blob/master/docs";

type SortDirection = "asc" | "desc";

export function TwStatsIndex() {
  const statsQuery = useGetTwStatsIndex();
  // 關鍵字與分類都寫回網址，分享或返回時保留篩選
  const [searchParams, updateParams] = useUpdateSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const categoryParam = searchParams.get("cat");
  const category = isTwStatsCategory(categoryParam) ? categoryParam : null;
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useTitle("台灣指標");

  const stats = useMemo(
    () =>
      Object.entries(statsQuery.data ?? {}).sort(([, a], [, b]) =>
        sortDirection === "asc"
          ? a.localeCompare(b, "zh-Hant")
          : b.localeCompare(a, "zh-Hant"),
      ),
    [sortDirection, statsQuery.data],
  );
  const keywordStats = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return stats;
    }

    return stats.filter(
      ([key, name]) =>
        key.toLowerCase().includes(normalizedKeyword) ||
        name.toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword, stats]);
  // 分類數量依關鍵字篩選後的結果計算，切換分類前就知道各類還剩幾筆
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    keywordStats.forEach(([key]) => {
      const id = categoryOf(key) ?? "";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return counts;
  }, [keywordStats]);
  const filteredStats = useMemo(
    () =>
      category
        ? keywordStats.filter(([key]) => categoryOf(key) === category)
        : keywordStats,
    [category, keywordStats],
  );

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant={"h3"} component={"h1"}>
          台灣指標
        </Typography>
        <Typography color={"text.secondary"}>
          搜尋公開資料指標，進入後可比較年份與各縣市數值。
        </Typography>
      </Stack>

      <TwStatsEntrances />

      <TextField
        type={"search"}
        label={"搜尋指標"}
        placeholder={"例如：人口、所得、出生"}
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          updateParams({ q: e.target.value.trim() });
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position={"start"}>
                <SearchIcon fontSize={"small"} />
              </InputAdornment>
            ),
          },
        }}
      />

      {statsQuery.isLoading && (
        <Stack direction={"row"} spacing={1.5} alignItems={"center"}>
          <CircularProgress size={22} />
          <Typography color={"text.secondary"}>載入指標中</Typography>
        </Stack>
      )}

      {statsQuery.isError && (
        <Alert severity={"error"}>指標清單載入失敗，請稍後再試。</Alert>
      )}

      {statsQuery.isSuccess && (
        <Stack spacing={2}>
          <TwStatsCategoryChips
            value={category}
            onChange={(cat) => updateParams({ cat })}
            total={keywordStats.length}
            counts={categoryCounts}
          />

          <Typography variant={"subtitle2"} color={"text.secondary"}>
            目前共有 {filteredStats.length.toLocaleString("zh-TW")}{" "}
            個符合條件指標
          </Typography>

          {filteredStats.length === 0 ? (
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 3,
                textAlign: "center",
              }}
            >
              <Typography color={"text.secondary"}>找不到符合的指標</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant={"outlined"}>
              <Table size={"small"}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 320 }}>
                      <TableSortLabel
                        active
                        direction={sortDirection}
                        onClick={() =>
                          setSortDirection((current) =>
                            current === "asc" ? "desc" : "asc",
                          )
                        }
                      >
                        指標名稱
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStats.map(([key, name]) => {
                    const sourceUrl = `${twStatsDocsBaseUri}/${encodeURIComponent(name)}/index.json`;
                    const githubUrl = `${twStatsGithubDocsBaseUri}/${encodeURIComponent(name)}/index.json`;

                    return (
                      <TableRow key={key} hover>
                        <TableCell component={"th"} scope={"row"}>
                          {name}
                        </TableCell>
                        <TableCell>
                          <Stack
                            direction={"row"}
                            spacing={1}
                            flexWrap={"wrap"}
                            useFlexGap
                          >
                            <Button
                              component={Link}
                              to={`/data/tw-stats/${encodeURIComponent(name)}`}
                              size={"small"}
                              variant={"contained"}
                              startIcon={<InsertChartOutlinedIcon />}
                            >
                              觀看資料及圖表
                            </Button>
                            <Button
                              component={"a"}
                              href={githubUrl}
                              target={"_blank"}
                              rel={"noreferrer"}
                              size={"small"}
                              variant={"outlined"}
                              startIcon={<OpenInNewIcon />}
                            >
                              觀看原始資料
                            </Button>
                            <Button
                              component={"a"}
                              href={sourceUrl}
                              download={`${name}.json`}
                              size={"small"}
                              variant={"outlined"}
                              startIcon={<DownloadIcon />}
                            >
                              下載資料
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )}
    </Stack>
  );
}
