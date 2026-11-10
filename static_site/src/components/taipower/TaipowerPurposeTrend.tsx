import { Box, ButtonBase, Paper, Stack, Typography } from "@mui/material";

import { summarizeTaipowerPurposes } from "@/helpers/taipowerPurpose.ts";
import type { TaipowerPurposeStatistic } from "@/types/taipower.ts";

interface Props {
  rows: TaipowerPurposeStatistic[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
}

// 年度長條以各年核准金額為基準，顏色呈現該年用途組成。
export function TaipowerPurposeTrend({
  rows,
  selectedYear,
  onSelectYear,
}: Props) {
  const byYear = new Map<number, TaipowerPurposeStatistic[]>();
  for (const row of rows) {
    const yearRows = byYear.get(row.year) ?? [];
    yearRows.push(row);
    byYear.set(row.year, yearRows);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
      <Typography variant="h5" component="h2" fontWeight={800}>
        年度變化
      </Typography>
      <Typography color="text.secondary" mt={0.5} mb={2}>
        每一列顯示該年的核准金額與用途組成；點選年度可查看明細。最新年度資料可能尚未完整。
      </Typography>
      <Stack spacing={1.5}>
        {years.map((year) => {
          const data = summarizeTaipowerPurposes(byYear.get(year) ?? []);
          return (
            <ButtonBase
              component="div"
              key={year}
              onClick={() => onSelectYear(String(year))}
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                borderRadius: 2,
                p: 1.2,
                bgcolor:
                  selectedYear === String(year)
                    ? "action.selected"
                    : "transparent",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ sm: "center" }}
                spacing={1.5}
              >
                <Typography fontWeight={800} sx={{ minWidth: 70 }}>
                  {year} 年
                </Typography>
                <Stack
                  direction="row"
                  sx={{
                    height: 20,
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "grey.100",
                    flex: 1,
                  }}
                >
                  {data.groups.map((group) => (
                    <Box
                      key={group.key ?? "small"}
                      title={`${group.label}：${data.cash ? ((group.cash / data.cash) * 100).toFixed(1) : 0}%`}
                      sx={{
                        width: `${data.cash ? (group.cash / data.cash) * 100 : 0}%`,
                        bgcolor: group.color,
                      }}
                    />
                  ))}
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ minWidth: 150, textAlign: { sm: "right" } }}
                >
                  {Math.round(data.cash * 1000).toLocaleString("zh-TW")} 元
                </Typography>
              </Stack>
            </ButtonBase>
          );
        })}
      </Stack>
    </Paper>
  );
}
