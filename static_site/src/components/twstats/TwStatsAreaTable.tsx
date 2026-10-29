import {
  Box,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TwStatsChangeRate } from "@/components/twstats/TwStatsChange.tsx";
import {
  formatStat,
  indicatorMapLink,
} from "@/components/twstats/twStatsFormat.ts";
import type { TwStatsAreaIndicator } from "@/types/twstats.ts";

type SortKey = "key" | "rank" | "change";

// 名次欄排序用「名次百分位」，各指標有資料的縣市數不同（例如 18/18 與 18/22）時才比得公平
const rankRatio = (i: TwStatsAreaIndicator) => i.rank / i.rank_total;

const sorters: Record<
  SortKey,
  (a: TwStatsAreaIndicator, b: TwStatsAreaIndicator) => number
> = {
  key: (a, b) => a.key.localeCompare(b.key),
  rank: (a, b) => rankRatio(a) - rankRatio(b),
  change: (a, b) => Math.abs(b.change_rate ?? 0) - Math.abs(a.change_rate ?? 0),
};

/** 縣市健檢下方的完整表格；分類與關鍵字篩選由頁面處理，這裡只管排序 */
export function TwStatsAreaTable({
  indicators,
}: {
  indicators: TwStatsAreaIndicator[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("key");
  const rows = useMemo(
    () => [...indicators].sort(sorters[sortKey]),
    [indicators, sortKey],
  );

  const sortLabel = (key: SortKey, label: string) => (
    <TableSortLabel
      active={sortKey === key}
      direction={"asc"}
      onClick={() => setSortKey(sortKey === key ? "key" : key)}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <TableContainer component={Paper} variant={"outlined"}>
        <Table
          size={"small"}
          sx={{
            "& thead th": { whiteSpace: "nowrap" },
            "& tbody th": { minWidth: 160 },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>指標</TableCell>
              <TableCell align={"right"}>年度</TableCell>
              <TableCell align={"right"}>數值</TableCell>
              <TableCell align={"right"}>每萬人</TableCell>
              <TableCell align={"right"}>{sortLabel("rank", "名次")}</TableCell>
              <TableCell align={"right"}>
                {sortLabel("change", "年增率")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} hover>
                <TableCell component={"th"} scope={"row"}>
                  <MuiLink
                    component={Link}
                    to={indicatorMapLink(row.name, row.year, row.per_capita)}
                    underline={"hover"}
                    color={"inherit"}
                  >
                    {row.name}
                  </MuiLink>
                </TableCell>
                <TableCell align={"right"}>{row.year}</TableCell>
                <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
                  {formatStat(row.value)}{" "}
                  <Typography
                    component={"span"}
                    variant={"caption"}
                    color={"text.secondary"}
                  >
                    {row.unit}
                  </Typography>
                </TableCell>
                <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
                  {row.per_capita_value !== undefined
                    ? formatStat(row.per_capita_value)
                    : "-"}
                </TableCell>
                <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
                  <Typography component={"span"} fontWeight={700}>
                    {row.rank}
                  </Typography>
                  <Typography
                    component={"span"}
                    variant={"caption"}
                    color={"text.secondary"}
                  >
                    {" "}
                    / {row.rank_total}
                  </Typography>
                </TableCell>
                <TableCell align={"right"}>
                  <TwStatsChangeRate rate={row.change_rate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
