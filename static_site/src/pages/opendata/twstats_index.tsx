import {
  Alert,
  Box,
  Breadcrumbs,
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

const twStatsDocsBaseUri =
  "https://raw.githubusercontent.com/faryne/tw-stats/master/docs";
const twStatsGithubDocsBaseUri =
  "https://github.com/faryne/tw-stats/blob/master/docs";

type SortDirection = "asc" | "desc";

export function TwStatsIndex() {
  const statsQuery = useGetTwStatsIndex();
  const [keyword, setKeyword] = useState("");
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
  const filteredStats = useMemo(() => {
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

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label={"breadcrumb"}>
        <Link to={"/"}>首頁</Link>
        <Typography color={"text.primary"}>台灣指標</Typography>
      </Breadcrumbs>

      <Stack spacing={1}>
        <Typography variant={"h3"} component={"h1"}>
          台灣指標
        </Typography>
        <Typography color={"text.secondary"}>
          搜尋公開資料指標，進入後可比較年份與各縣市數值。
        </Typography>
      </Stack>

      <TextField
        type={"search"}
        label={"搜尋指標"}
        placeholder={"例如：人口、所得、出生"}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
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
