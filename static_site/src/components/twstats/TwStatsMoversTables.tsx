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
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  TwStatsChangeRate,
  TwStatsRankChange,
} from "@/components/twstats/TwStatsChange.tsx";
import {
  areaProfileLink,
  categoryLabel,
  formatStat,
  indicatorMapLink,
} from "@/components/twstats/twStatsFormat.ts";
import type {
  TwStatsCountyMover,
  TwStatsNationalMover,
} from "@/types/twstats.ts";

// 兩張榜共用的外框；空結果時顯示一行提示
function MoversTable({
  head,
  empty,
  children,
}: {
  head: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  if (empty) {
    return (
      <Typography color={"text.secondary"} sx={{ py: 3, textAlign: "center" }}>
        這個條件下沒有變化
      </Typography>
    );
  }
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
            <TableRow>{head}</TableRow>
          </TableHead>
          <TableBody>{children}</TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

const valueWithUnit = (value: number, unit: string) => (
  <>
    {formatStat(value)}{" "}
    <Typography component={"span"} variant={"caption"} color={"text.secondary"}>
      {unit}
    </Typography>
  </>
);

/** 全國榜：「台灣」數值相較前一年的變化率，依幅度排序 */
export function TwStatsNationalMovers({
  year,
  rows,
}: {
  year: number;
  rows: TwStatsNationalMover[];
}) {
  return (
    <MoversTable
      empty={rows.length === 0}
      head={
        <>
          <TableCell>指標</TableCell>
          <TableCell>分類</TableCell>
          <TableCell align={"right"}>{year - 1}</TableCell>
          <TableCell align={"right"}>{year}</TableCell>
          <TableCell align={"right"}>年增率</TableCell>
        </>
      }
    >
      {rows.map((row) => (
        <TableRow key={row.key} hover>
          <TableCell component={"th"} scope={"row"}>
            <MuiLink
              component={Link}
              to={indicatorMapLink(row.name, year, false)}
              underline={"hover"}
              color={"inherit"}
            >
              {row.name}
            </MuiLink>
          </TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>
            {categoryLabel(row.category)}
          </TableCell>
          <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
            {valueWithUnit(row.previous_value, row.unit)}
          </TableCell>
          <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
            {valueWithUnit(row.value, row.unit)}
          </TableCell>
          <TableCell align={"right"}>
            <TwStatsChangeRate rate={row.change_rate} />
          </TableCell>
        </TableRow>
      ))}
    </MoversTable>
  );
}

/** 縣市榜：22 縣市名次變化，依名次變動幅度排序 */
export function TwStatsCountyMovers({
  year,
  rows,
}: {
  year: number;
  rows: TwStatsCountyMover[];
}) {
  return (
    <MoversTable
      empty={rows.length === 0}
      head={
        <>
          <TableCell>縣市</TableCell>
          <TableCell>指標</TableCell>
          <TableCell align={"right"}>名次</TableCell>
          <TableCell align={"right"}>變化</TableCell>
          <TableCell align={"right"}>{year} 數值</TableCell>
          <TableCell align={"right"}>年增率</TableCell>
        </>
      }
    >
      {rows.map((row) => (
        <TableRow key={`${row.key}-${row.area.code}`} hover>
          <TableCell sx={{ whiteSpace: "nowrap" }}>
            <MuiLink
              component={Link}
              to={areaProfileLink(row.area.code)}
              underline={"hover"}
              color={"inherit"}
            >
              {row.area.name}
            </MuiLink>
          </TableCell>
          <TableCell component={"th"} scope={"row"}>
            <MuiLink
              component={Link}
              to={indicatorMapLink(row.name, year, row.per_capita)}
              underline={"hover"}
              color={"inherit"}
            >
              {row.name}
            </MuiLink>
          </TableCell>
          <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
            {row.previous_rank} → <b>{row.rank}</b>
          </TableCell>
          <TableCell align={"right"}>
            <TwStatsRankChange change={row.rank_change} />
          </TableCell>
          <TableCell align={"right"} sx={{ whiteSpace: "nowrap" }}>
            {row.per_capita_value !== undefined
              ? valueWithUnit(row.per_capita_value, `${row.unit}/萬人`)
              : valueWithUnit(row.value, row.unit)}
          </TableCell>
          <TableCell align={"right"}>
            <TwStatsChangeRate rate={row.change_rate} />
          </TableCell>
        </TableRow>
      ))}
    </MoversTable>
  );
}
