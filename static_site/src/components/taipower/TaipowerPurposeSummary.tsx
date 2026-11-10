import {
  Box,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { TaipowerPurposeKey } from "@/types/taipower.ts";
import type { PurposeGroup } from "@/helpers/taipowerPurpose.ts";

interface Props {
  count: number;
  cash: number;
  unclassifiedCount: number;
  groups: PurposeGroup[];
  detailPath: (purpose: TaipowerPurposeKey) => string;
}

function formatCash(value: number) {
  return Math.round(value * 1000).toLocaleString("zh-TW");
}

function compactCash(value: number) {
  const amount = Math.round(value * 1000);
  return amount >= 100_000_000
    ? `${(amount / 100_000_000).toFixed(1)} 億元`
    : `${amount.toLocaleString("zh-TW")} 元`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 3, flex: 1, minWidth: 0 }}
    >
      <Typography variant="body2" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} mt={1}>
        {value}
      </Typography>
    </Paper>
  );
}

// 顯示互斥用途的核准件數與金額，少量案件由上游摘要函式合併。
export function TaipowerPurposeSummary({
  count,
  cash,
  unclassifiedCount,
  groups,
  detailPath,
}: Props) {
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Metric
          label="核准案件"
          value={`${count.toLocaleString("zh-TW")} 筆`}
        />
        <Metric label="核准金額" value={compactCash(cash)} />
        <Metric
          label="未分類案件占比"
          value={`${count ? ((unclassifiedCount / count) * 100).toFixed(1) : "0.0"}%`}
        />
      </Stack>

      <Paper
        variant="outlined"
        sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}
      >
        <Typography variant="h5" component="h2" fontWeight={800}>
          核准金額的用途分布
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          每筆只歸入一個主用途；詳細資料可從下表查閱。
        </Typography>
        <Stack
          direction="row"
          sx={{
            height: 38,
            borderRadius: 2,
            overflow: "hidden",
            mt: 3,
            bgcolor: "grey.100",
          }}
        >
          {groups.map((group) => (
            <Box
              key={group.key ?? "small"}
              title={`${group.label}：${cash ? ((group.cash / cash) * 100).toFixed(1) : 0}%`}
              sx={{
                width: `${cash ? (group.cash / cash) * 100 : 0}%`,
                bgcolor: group.color,
              }}
            />
          ))}
        </Stack>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} mt={2}>
          {groups.map((group) => (
            <Stack
              key={group.key ?? "small"}
              direction="row"
              alignItems="center"
              spacing={0.7}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: group.color,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {group.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ px: { xs: 2.5, md: 3.5 }, pt: 3, pb: 1 }}>
          <Typography variant="h5" component="h2" fontWeight={800}>
            各用途明細
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            占比以核准金額計算，金額顯示為新台幣元。
          </Typography>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell>主用途</TableCell>
                <TableCell align="right">案件數</TableCell>
                <TableCell align="right">核准金額</TableCell>
                <TableCell align="right">金額占比</TableCell>
                <TableCell align="right">逐筆資料</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.key ?? "small"} hover>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Box
                      component="span"
                      sx={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: 0.5,
                        bgcolor: group.color,
                        mr: 1,
                      }}
                    />
                    {group.label}
                  </TableCell>
                  <TableCell align="right">
                    {group.count.toLocaleString("zh-TW")}
                  </TableCell>
                  <TableCell align="right">{formatCash(group.cash)}</TableCell>
                  <TableCell align="right">
                    {cash ? ((group.cash / cash) * 100).toFixed(1) : "0.0"}%
                  </TableCell>
                  <TableCell align="right">
                    {group.key && (
                      <Link component={RouterLink} to={detailPath(group.key)}>
                        查看案件 ›
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!groups.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    此範圍沒有資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ p: 2.5 }}
        >
          用途由申請摘要的文字規則分類，可能有誤；核准金額不等於實際撥款或成果。少於
          5 筆的類別合併顯示。
        </Typography>
      </Paper>
    </Stack>
  );
}
